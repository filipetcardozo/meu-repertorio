"""
Cloud Functions (Python, 2ª geração) do Toca Mais Uma.

analyze_playback: quando um mp3 chega em Storage playbacks/{uid}/{id}.{ext}, lê a cifra da música,
  analisa o áudio (andamento, batidas, acordes, tom), alinha com a cifra e grava a linha do tempo
  em Firestore playbacks/{id}.
resync_playback (chamável): refaz só o alinhamento com a cifra atual, usando a análise guardada.
cleanup_playback: quando o playback é apagado, apaga a análise guardada.
"""
from __future__ import annotations

import hashlib
import io
import os
import re
import tempfile

from firebase_admin import firestore, initialize_app, storage
from firebase_functions import firestore_fn, https_fn, options, storage_fn

# numpy/scipy e o pacote de sincronia são importados dentro das funções: carregar tudo no início
# estoura o tempo que o Firebase dá para descobrir as funções (e deixa o cold start mais lento).

initialize_app()

PATH_RE = re.compile(r"^playbacks/([^/]+)/([^/.]+)\.(mp3|m4a|wav|ogg|flac)$", re.I)
REGION = "us-central1"


def _result_fields(cifra, html: str, a, res) -> dict:
    timeline = []
    for item in res.timeline:
        e = cifra.events[item["event"]] if item["event"] is not None else None
        timeline.append({
            "t": round(item["t"], 3),
            "lyricIdx": e.lyric_idx if e else None,
            "text": e.text if e and e.text else None,
            "chords": [c.name for c in e.chords] if e else None,
            "section": (cifra.sections[e.section].title or None) if e else None,
            "conf": None if item["conf"] is None else round(item["conf"], 3),
        })
    return {
        "status": "ready",
        "error": None,
        "durationSec": round(a.duration, 2),
        "bpm": round(a.bpm, 1),
        "transpose": res.transpose,
        "timeline": timeline,
        "cifraHash": hashlib.sha1(html.encode("utf-8")).hexdigest(),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }


def _cifra_of(db, lyric_id: str):
    from playback_sync.cifra import parse_cifra

    lyric = db.collection("lyrics").document(lyric_id).get()
    html = lyric.get("lyric") if lyric.exists else None
    if not html:
        raise ValueError("Música sem cifra")
    cifra = parse_cifra(html)
    if not any(e.chords for e in cifra.events):
        raise ValueError("A cifra não tem acordes para sincronizar")
    return cifra, html


@storage_fn.on_object_finalized(
    region=REGION,
    memory=options.MemoryOption.GB_2,
    cpu=1,
    timeout_sec=540,
    max_instances=5,
)
def analyze_playback(event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    m = PATH_RE.match(event.data.name or "")
    if not m:
        return
    uid, playback_id = m.group(1), m.group(2)
    db = firestore.client()
    ref = db.collection("playbacks").document(playback_id)
    snap = ref.get()
    if not snap.exists or snap.get("userId") != uid:
        return  # arquivo sem doc correspondente (ou de outro usuário): ignora

    ref.update({"status": "processing", "error": None, "updatedAt": firestore.SERVER_TIMESTAMP})
    try:
        import numpy as np

        from playback_sync.align import align
        from playback_sync.features import analyze

        cifra, html = _cifra_of(db, snap.get("lyricId"))

        bucket = storage.bucket(event.data.bucket)
        with tempfile.TemporaryDirectory() as tmp:
            local = os.path.join(tmp, os.path.basename(event.data.name))
            bucket.blob(event.data.name).download_to_filename(local)
            a = analyze(local)
        res = align(cifra, a)

        # análise guardada para re-sincronizar (quando a cifra mudar) sem reprocessar o áudio
        buf = io.BytesIO()
        np.savez_compressed(buf, beats=a.beats, units=a.units, chroma=a.chroma, bass=a.bass,
                            energy=a.energy, meta=np.array([a.duration, a.bpm]))
        analysis_path = f"playbacks/{uid}/analysis/{playback_id}.npz"
        bucket.blob(analysis_path).upload_from_string(buf.getvalue(), content_type="application/octet-stream")

        ref.update({**_result_fields(cifra, html, a, res), "analysisPath": analysis_path})
    except Exception as exc:  # noqa: BLE001 — o erro vai para o app mostrar
        ref.update({"status": "error", "error": str(exc)[:300], "updatedAt": firestore.SERVER_TIMESTAMP})
        raise


@https_fn.on_call(region=REGION, memory=options.MemoryOption.GB_1, timeout_sec=120)
def resync_playback(req: https_fn.CallableRequest) -> dict:
    if not req.auth:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Entre na sua conta.")
    playback_id = str((req.data or {}).get("playbackId") or "")
    db = firestore.client()
    ref = db.collection("playbacks").document(playback_id)
    snap = ref.get() if playback_id else None
    if not snap or not snap.exists or snap.get("userId") != req.auth.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Playback não encontrado.")
    data = snap.to_dict()
    if not data.get("analysisPath"):
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Playback ainda não foi analisado.")
    try:
        cifra, html = _cifra_of(db, data["lyricId"])
    except ValueError as exc:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, str(exc))
    import numpy as np

    from playback_sync.align import align
    from playback_sync.features import Analysis

    raw = storage.bucket().blob(data["analysisPath"]).download_as_bytes()
    z = np.load(io.BytesIO(raw))
    duration, bpm = (float(x) for x in z["meta"])
    a = Analysis(duration=duration, bpm=bpm, beats=z["beats"], units=z["units"], chroma=z["chroma"],
                 bass=z["bass"], energy=z["energy"])
    res = align(cifra, a)
    ref.update(_result_fields(cifra, html, a, res))
    return {"ok": True}


@firestore_fn.on_document_deleted(document="playbacks/{playbackId}", region=REGION)
def cleanup_playback(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    snap = event.data
    path = snap.get("analysisPath") if snap is not None and snap.exists else None
    if path:
        blob = storage.bucket().blob(path)
        if blob.exists():
            blob.delete()
