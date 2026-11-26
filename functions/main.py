"""
Cloud Functions (Python, 2ª geração) do Toca Mais Uma.

O trabalho pesado de um playback (separar as faixas, reconhecer a letra na voz, analisar a harmonia
e alinhar com a cifra) roda no Cloud Run Job `process-playback` (pasta worker/). As funções daqui
só disparam o job, refazem o alinhamento e limpam:

analyze_playback: quando o áudio chega em Storage playbacks/{uid}/{id}.{ext}, marca o playback como
  'processing' e dispara o job. A música só fica pronta quando o job termina (sem nada provisório).
reprocess_playback (chamável): processa de novo um playback (antigo, com erro ou parado no meio).
resync_playback (chamável): refaz só o alinhamento com a cifra atual, usando a análise e as palavras
  guardadas pelo job (rápido, sem reprocessar o áudio).
generate_cifra (chamável): gera uma cifra a partir do áudio (acordes do consonance-ACE + letra) e
  grava em `generated` no playback. Usa a análise, as palavras e os acordes guardados pelo job
  (segundos, sem PyTorch); playback ainda sem análise é processado de novo pelo job, que gera a cifra no
  fim, e playback de antes do ACE (sem `chordsPath`) dispara o job só para os acordes (`chordsJob`).
cleanup_playback: quando o playback é apagado, apaga a análise, as palavras e as faixas separadas.

Processar no PC (testes de quem desenvolve): playback criado com `processor: 'local'` (app rodando com
NEXT_PUBLIC_LOCAL_WORKER=1, ver scripts/dev-local.ps1) por uma conta com `users/{uid}.isAdmin` não dispara o
Cloud Run: fica com `localWorker: 'waiting'` até o worker/local_listener.py, no PC, processar (com o
BS-RoFormer). Para as outras contas a marca é ignorada.
"""
from __future__ import annotations

import os
import re
import time

from firebase_admin import firestore, initialize_app, storage
from firebase_functions import firestore_fn, https_fn, options, storage_fn

# numpy/scipy e o pacote de sincronia são importados dentro das funções: carregar tudo no início
# estoura o tempo que o Firebase dá para descobrir as funções (e deixa o cold start mais lento).

initialize_app()

PATH_RE = re.compile(r"^playbacks/([^/]+)/([^/.]+)\.(mp3|m4a|wav|ogg|flac)$", re.I)
REGION = "us-central1"
JOB_NAME = "process-playback"
# Processamento parado há mais que isso (job morto, sem memória...) pode ser refeito. O job tem
# limite de 30 min e grava o progresso a cada poucos segundos.
STALE_SEC = 35 * 60


def _on_pc(data: dict) -> bool:
    """Playback marcado para processar no PC de quem desenvolve (só vale para admin)."""
    if (data or {}).get("processor") != "local" or not data.get("userId"):
        return False
    user = firestore.client().collection("users").document(data["userId"]).get()
    return bool(user.exists and user.to_dict().get("isAdmin"))


def _dispatch(ref, playback_id: str, data: dict) -> None:
    """Produção: executa o Cloud Run Job. Emulador: roda o comando local de PROCESS_LOCAL_CMD. Marcado
    para o PC (admin): só avisa o worker/local_listener.py (`localWorker: 'waiting'`)."""
    if _on_pc(data):
        ref.update({"localWorker": "waiting"})
        return
    local_cmd = os.environ.get("PROCESS_LOCAL_CMD")
    if local_cmd:
        import shlex
        import subprocess

        subprocess.Popen(shlex.split(local_cmd.replace("{playbackId}", playback_id), posix=os.name != "nt"))
        return
    import google.auth
    from google.auth.transport.requests import AuthorizedSession

    creds, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    job = os.environ.get("PROCESS_JOB") or f"projects/{project}/locations/{REGION}/jobs/{JOB_NAME}"
    body = {"overrides": {"containerOverrides": [{"env": [{"name": "PLAYBACK_ID", "value": playback_id}]}]}}
    r = AuthorizedSession(creds).post(f"https://run.googleapis.com/v2/{job}:run", json=body, timeout=30)
    if r.status_code >= 300:
        raise RuntimeError(f"Cloud Run {r.status_code}: {r.text[:200]}")


def _queue(ref, playback_id: str, data: dict) -> None:
    ref.update({"status": "processing", "stage": "queued", "progress": 0, "error": None,
                "updatedAt": firestore.SERVER_TIMESTAMP})
    try:
        _dispatch(ref, playback_id, data)
    except Exception as exc:  # noqa: BLE001
        print(f"falha ao disparar o processamento de {playback_id}: {exc}")
        ref.update({"status": "error", "stage": None, "error": "Não foi possível iniciar o processamento.",
                    "updatedAt": firestore.SERVER_TIMESTAMP})
        raise


@storage_fn.on_object_finalized(region=REGION, memory=options.MemoryOption.MB_256, timeout_sec=60, max_instances=10)
def analyze_playback(event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    m = PATH_RE.match(event.data.name or "")
    if not m:
        return
    uid, playback_id = m.group(1), m.group(2)
    ref = firestore.client().collection("playbacks").document(playback_id)
    snap = ref.get()
    if not snap.exists or snap.get("userId") != uid:
        return  # arquivo sem doc correspondente (ou de outro usuário): ignora
    _queue(ref, playback_id, snap.to_dict())


def _owned(req: https_fn.CallableRequest):
    if not req.auth:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Entre na sua conta.")
    playback_id = str((req.data or {}).get("playbackId") or "")
    ref = firestore.client().collection("playbacks").document(playback_id)
    snap = ref.get() if playback_id else None
    if not snap or not snap.exists or snap.get("userId") != req.auth.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Playback não encontrado.")
    return playback_id, ref, snap.to_dict()


@https_fn.on_call(region=REGION, memory=options.MemoryOption.MB_256, timeout_sec=60)
def reprocess_playback(req: https_fn.CallableRequest) -> dict:
    playback_id, ref, data = _owned(req)
    st = data.get("status")
    if st == "uploading":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Espere o áudio terminar de subir.")
    if st == "processing":
        upd = data.get("updatedAt")
        age = time.time() - upd.timestamp() if hasattr(upd, "timestamp") else STALE_SEC
        if age < STALE_SEC:
            return {"ok": True, "status": "processing"}
    try:
        _queue(ref, playback_id, data)
    except Exception:  # noqa: BLE001
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAVAILABLE, "Não foi possível iniciar o processamento.")
    return {"ok": True, "status": "processing"}


@https_fn.on_call(region=REGION, memory=options.MemoryOption.GB_1, timeout_sec=120)
def resync_playback(req: https_fn.CallableRequest) -> dict:
    playback_id, ref, data = _owned(req)
    if not data.get("analysisPath"):
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Playback ainda não foi analisado.")
    from playback_sync.align import align
    from playback_sync.pipeline import analysis_from_bytes, load_cifra, result_fields, words_from_bytes

    try:
        cifra, html = load_cifra(firestore.client(), data["lyricId"])
    except ValueError as exc:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, str(exc))
    bucket = storage.bucket()
    a = analysis_from_bytes(bucket.blob(data["analysisPath"]).download_as_bytes())
    words = None
    if data.get("wordsPath"):
        words = words_from_bytes(bucket.blob(data["wordsPath"]).download_as_bytes())
    res = align(cifra, a, words=words or None)
    ref.update({**result_fields(cifra, html, a, res), "updatedAt": firestore.SERVER_TIMESTAMP})
    return {"ok": True}


def _generate_input(req: https_fn.CallableRequest) -> dict:
    """Letra informada pelo app (internet ou digitada) e, se houver, as linhas sincronizadas (LRC)."""
    body = req.data or {}
    lyrics = str(body.get("lyrics") or "")[:20000]
    synced = []
    for x in (body.get("synced") or [])[:600]:
        try:
            synced.append({"t": float(x["t"]), "text": str(x.get("text") or "")[:300]})
        except (KeyError, TypeError, ValueError):
            continue
    source = str(body.get("lyricsSource") or "")[:40] or None
    return {"lyrics": lyrics, "synced": synced, "source": source}


@https_fn.on_call(region=REGION, memory=options.MemoryOption.GB_1, timeout_sec=120)
def generate_cifra(req: https_fn.CallableRequest) -> dict:
    playback_id, ref, data = _owned(req)
    gin = _generate_input(req)
    st = data.get("status")
    if st == "uploading":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Espere o áudio terminar de subir.")
    if not data.get("analysisPath") or (not data.get("wordsPath") and not data.get("stems")):
        # sem análise (ou de antes das faixas, sem a letra reconhecida): o job processa e gera no fim
        # o job lê a letra informada no fim do processamento
        if st == "processing":
            ref.update({"generate": True, "generateInput": gin, "updatedAt": firestore.SERVER_TIMESTAMP})
            return {"ok": True, "status": "processing"}
        ref.update({"generate": True, "generateInput": gin})
        try:
            _queue(ref, playback_id, data)
        except Exception:  # noqa: BLE001
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAVAILABLE, "Não foi possível iniciar o processamento.")
        return {"ok": True, "status": "processing"}

    path = data.get("chordsPath")
    bucket = storage.bucket()
    if not path or not bucket.blob(path).exists():
        # playback de antes do ACE: o job roda só os acordes (faixas, voz e análise já estão guardadas)
        ref.update({"generate": True, "generateInput": gin, "chordsJob": True, "generated.status": "processing",
                    "generated.error": None, "generated.requestedAt": firestore.SERVER_TIMESTAMP,
                    "updatedAt": firestore.SERVER_TIMESTAMP})
        try:
            _dispatch(ref, playback_id, data)
        except Exception:  # noqa: BLE001
            ref.update({"chordsJob": None, "generated.status": "error",
                        "generated.error": "Não foi possível iniciar o reconhecimento dos acordes."})
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAVAILABLE, "Não foi possível iniciar o processamento.")
        return {"ok": True, "status": "processing"}

    import json

    from playback_sync.pipeline import analysis_from_bytes, chords_from_bytes, generated_from, words_from_bytes

    a = analysis_from_bytes(bucket.blob(data["analysisPath"]).download_as_bytes())
    words, model = [], None
    if data.get("wordsPath"):  # sem palavras = playback sem voz: sai só com os acordes
        raw_words = bucket.blob(data["wordsPath"]).download_as_bytes()
        words = words_from_bytes(raw_words)
        model = json.loads(raw_words.decode("utf-8")).get("model")
    _, fields = generated_from(a, chords_from_bytes(bucket.blob(path).download_as_bytes()), words, gin, model)
    ref.update({
        "generate": True,
        "generateInput": gin,
        "generated": {**fields, "createdAt": firestore.SERVER_TIMESTAMP},
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {"ok": True, "status": "ready"}


@firestore_fn.on_document_deleted(document="playbacks/{playbackId}", region=REGION)
def cleanup_playback(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    snap = event.data
    if snap is None or not snap.exists:
        return
    data = snap.to_dict() or {}
    bucket = storage.bucket()
    for path in (data.get("analysisPath"), data.get("wordsPath"), data.get("chordsPath")):
        if path:
            blob = bucket.blob(path)
            if blob.exists():
                blob.delete()
    # faixas separadas
    for blob in bucket.list_blobs(prefix=f"playbacks/{data.get('userId')}/stems/{event.params['playbackId']}/"):
        blob.delete()
