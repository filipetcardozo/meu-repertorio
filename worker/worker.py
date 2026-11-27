"""
Processamento completo de um playback (Cloud Run Job `process-playback`).

Disparado pela Function `analyze_playback` quando o áudio chega no Storage (ou por
`reprocess_playback`). Cada execução cuida de UM playback, nesta ordem:

1. separa o áudio em 6 faixas (Demucs htdemucs_6s) e grava em `playbacks/{uid}/stems/{id}/{faixa}.mp3`
   (playback de faixas prontas, `source: 'stems'`, ex.: Moises: só junta as faixas enviadas, imported.py);
2. reconhece a letra na faixa de voz (faster-whisper), com o tempo de cada palavra;
3. analisa a harmonia do áudio original e alinha com a cifra usando acordes + letra;
4. grava a linha do tempo, a análise e as palavras (para re-sincronizar quando a cifra mudar);
5. com `generate: true` no documento, gera também uma cifra a partir do áudio e grava em `generated`:
   os acordes vêm do consonance-ACE (chords_ace.py) e a montagem é playback_sync/generate.py. Os
   acordes ficam em `chordsPath` (`playbacks/{uid}/analysis/{id}.chords.json`) para a Function
   `generate_cifra` regenerar sem PyTorch. Se a música ainda não tem cifra (ou o playback não tem
   música, criado na tela de adicionar música), a sincronia usa a cifra gerada.

Só acordes (`chordsJob`, disparado por `generate_cifra` num playback processado antes do ACE): baixa o
áudio, a análise e as palavras guardadas, roda só o ACE e grava `generated` e `chordsPath`, sem refazer
faixas, voz nem sincronia (e sem mexer no `status` do playback).

O documento `playbacks/{id}` mostra o andamento ao app:

    status: 'processing' → 'ready' | 'error'
    stage: 'queued' | 'separating' | 'transcribing' | 'syncing', progress: 0..1
    stems: {status: 'ready'|'error', tracks: [{name, path}], gain, durationSec, model, error}
    voiceWords: palavras reconhecidas usadas no alinhamento (0 = só acordes)

Só a sincronia é obrigatória: se a separação ou o reconhecimento falharem, alinha só pelos acordes
e o playback fica pronto do mesmo jeito (sem faixas separadas). O áudio original nunca é alterado.

    python worker.py <playbackId>        (ou PLAYBACK_ID no ambiente)

Emuladores: defina FIRESTORE_EMULATOR_HOST e STORAGE_EMULATOR_HOST (ex.: http://127.0.0.1:9199).
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
import traceback

import firebase_admin
import firebase_admin.credentials
from firebase_admin import firestore, storage

STEM_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other"]

# andamento: fatia de cada etapa na barra de progresso
P_SEPARATE = (0.02, 0.55)
P_UPLOAD = (0.55, 0.6)
P_TRANSCRIBE = (0.6, 0.92)


def _init_firebase():
    bucket_name = os.environ.get("STORAGE_BUCKET")
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
    opts = {"storageBucket": bucket_name} if bucket_name else {}
    if project:
        opts["projectId"] = project
    cred = None
    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        # emuladores não checam credencial (e não há ADC no contêiner local)
        from google.auth.credentials import AnonymousCredentials

        class _Anon(firebase_admin.credentials.Base):
            def get_credential(self):
                return AnonymousCredentials()

        cred = _Anon()
    firebase_admin.initialize_app(cred, options=opts)


def recognize_chords(src: str, bucket, uid: str, playback_id: str) -> tuple[dict, str]:
    """consonance-ACE no áudio original; grava os acordes no Storage. Devolve (acordes, caminho)."""
    from chords_ace import recognize
    from playback_sync.pipeline import chords_bytes, chords_path

    doc = recognize(src)
    path = chords_path(uid, playback_id)
    bucket.blob(path).upload_from_string(chords_bytes(doc), content_type="application/json")
    print(f"acordes: {len(doc['segments'])} segmentos em {doc['sec']:.1f}s ({doc['model']})")
    return doc, path


def chords_job(ref, data: dict, bucket, playback_id: str) -> int:
    """Só acordes: gera `generated` com o ACE num playback já processado antes dele."""
    import json

    from playback_sync.pipeline import analysis_from_bytes, generated_from, words_from_bytes

    try:
        a = analysis_from_bytes(bucket.blob(data["analysisPath"]).download_as_bytes())
        words, model = [], None
        if data.get("wordsPath"):
            raw = bucket.blob(data["wordsPath"]).download_as_bytes()
            words, model = words_from_bytes(raw), json.loads(raw.decode("utf-8")).get("model")
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, os.path.basename(data["storagePath"]))
            bucket.blob(data["storagePath"]).download_to_filename(src)
            doc, path = recognize_chords(src, bucket, data["userId"], playback_id)
        g, fields = generated_from(a, doc, words, data.get("generateInput"), model)
        print(f"cifra gerada: tom {g.tone}, {g.lines} linhas, {len(g.chords)} acordes")
        if ref.get().exists:
            ref.update({"chordsJob": None, "chordsPath": path,
                        "generated": {**fields, "createdAt": firestore.SERVER_TIMESTAMP},
                        "updatedAt": firestore.SERVER_TIMESTAMP})
        return 0
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        if ref.get().exists:
            ref.update({"chordsJob": None, "generated.status": "error",
                        "generated.error": f"Não foi possível gerar a cifra: {exc}"[:300],
                        "updatedAt": firestore.SERVER_TIMESTAMP})
        return 1


def separate_stems(src: str, tmp: str, uid: str, playback_id: str, bucket, uploaded: list[str], progress,
                   t0: float):
    """Separa o áudio (Demucs) e grava as faixas. Devolve (stems_field, voz ou None).
    Se falhar, segue sem faixas (stems_field com status 'error')."""
    vocals = None
    try:
        from separate import MODEL_NAME, decode, encode_mp3, separate

        res = separate(decode(src), on_progress=progress(P_SEPARATE))
        print(f"separado em {time.monotonic() - t0:.1f}s ({res.duration:.0f}s de áudio)")
        order = [n for n in STEM_ORDER if n in res.names] + [n for n in res.names if n not in STEM_ORDER]
        tracks = []
        for i, name in enumerate(order):
            local = os.path.join(tmp, f"{name}.mp3")
            encode_mp3(res.stems[res.names.index(name)], local)
            path = f"playbacks/{uid}/stems/{playback_id}/{name}.mp3"
            blob = bucket.blob(path)
            blob.cache_control = "private, max-age=31536000"
            blob.upload_from_filename(local, content_type="audio/mpeg")
            uploaded.append(path)
            tracks.append({"name": name, "path": path})
            progress(P_UPLOAD)((i + 1) / len(order))
        stems_field = {"status": "ready", "tracks": tracks, "gain": round(res.gain, 4),
                       "durationSec": round(res.duration, 2), "model": MODEL_NAME, "error": None}
        if "vocals" in res.names:
            vocals = res.stems[res.names.index("vocals")]
        del res
    except Exception as exc:  # noqa: BLE001 — segue sem faixas
        traceback.print_exc()
        stems_field = {"status": "error", "error": f"Não foi possível separar: {exc}"[:300]}
    return stems_field, vocals


def main(playback_id: str) -> int:
    _init_firebase()
    db = firestore.client()
    bucket = storage.bucket()
    ref = db.collection("playbacks").document(playback_id)
    snap = ref.get()
    if not snap.exists:
        print(f"playback {playback_id} não existe", file=sys.stderr)
        return 0
    data = snap.to_dict()
    if data.get("chordsJob") and data.get("analysisPath") and data.get("status") == "ready":
        return chords_job(ref, data, bucket, playback_id)
    uid = data["userId"]
    uploaded: list[str] = []
    last = {"t": 0.0, "p": -1.0}

    def update(fields: dict):
        ref.update({**fields, "updatedAt": firestore.SERVER_TIMESTAMP})

    def stage(name: str, p: float):
        last.update(t=time.monotonic(), p=p)
        update({"status": "processing", "stage": name, "progress": round(p, 3), "error": None})

    def progress(span: tuple[float, float]):
        a, b = span

        def cb(f: float):
            p = a + (b - a) * f
            now = time.monotonic()
            if p - last["p"] >= 0.02 and now - last["t"] >= 2:  # no máximo ~1 escrita a cada 2 s
                last.update(t=now, p=p)
                update({"progress": round(p, 3)})
        return cb

    t0 = time.monotonic()
    try:
        from playback_sync.align import align
        from playback_sync.features import analyze
        from playback_sync.cifra import parse_cifra
        from playback_sync.pipeline import analysis_bytes, load_cifra, result_fields, words_bytes

        want_generate = bool(data.get("generate"))
        cifra = html = None
        try:
            cifra, html = load_cifra(db, data["lyricId"]) if data.get("lyricId") else (None, None)
        except ValueError:
            if not want_generate:
                raise
        if cifra is None and not want_generate:
            raise ValueError("Música sem cifra")  # sem cifra não adianta processar o resto
        with tempfile.TemporaryDirectory() as tmp:
            # 1. faixas
            stems_field: dict
            vocals = None
            stage("separating", P_SEPARATE[0])
            if data.get("source") == "stems":
                # faixas prontas (ex.: Moises): junta em vez de separar (imported.py)
                import imported

                if data.get("importStems"):
                    stems_field, vocals, src, paths, originals = imported.from_import(
                        data, bucket, tmp, playback_id, on_progress=progress((P_SEPARATE[0], P_UPLOAD[1])))
                    uploaded.extend(paths)
                    # grava já: se algo der errado depois, reprocessar usa as faixas convertidas
                    update({"stems": stems_field, "importStems": firestore.DELETE_FIELD})
                    for p in originals:
                        try:
                            bucket.blob(p).delete()
                        except Exception:  # noqa: BLE001
                            traceback.print_exc()
                else:
                    stems_field, vocals, src = imported.from_saved(data, bucket, tmp)
            else:
                src = os.path.join(tmp, os.path.basename(data["storagePath"]))
                bucket.blob(data["storagePath"]).download_to_filename(src)
                stems_field, vocals = separate_stems(src, tmp, uid, playback_id, bucket, uploaded, progress, t0)

            # 2. letra na voz
            words: list[dict] = []
            model_name = None
            if vocals is not None:
                stage("transcribing", P_TRANSCRIBE[0])
                try:
                    from transcribe import WHISPER_MODEL, transcribe

                    t1 = time.monotonic()
                    words = transcribe(vocals, on_progress=progress(P_TRANSCRIBE))
                    model_name = WHISPER_MODEL
                    print(f"{len(words)} palavras em {time.monotonic() - t1:.1f}s")
                except Exception:  # noqa: BLE001 — segue só com os acordes
                    traceback.print_exc()
                    words = []
                vocals = None

            # 3. harmonia + alinhamento
            stage("syncing", P_TRANSCRIBE[1])
            a = analyze(src)

            # 4. cifra gerada pela plataforma (os acordes precisam do áudio: roda antes de apagar a pasta)
            generated_field = None
            chords_path = None
            if want_generate:
                from playback_sync.pipeline import generated_from

                try:
                    chords_doc, chords_path = recognize_chords(src, bucket, uid, playback_id)
                    uploaded.append(chords_path)
                    # a letra informada pode ter chegado durante o processamento (generate_cifra)
                    fresh = ref.get()
                    gin = (fresh.to_dict() or {}).get("generateInput") if fresh.exists else None
                    gin = gin or data.get("generateInput") or {}
                    g, fields = generated_from(a, chords_doc, words, gin, model_name)
                    generated_field = {**fields, "createdAt": firestore.SERVER_TIMESTAMP}
                    print(f"cifra gerada: tom {g.tone}, {g.lines} linhas, {len(g.chords)} acordes")
                    if cifra is None:
                        cifra, html = parse_cifra(g.html), g.html
                except Exception as exc:  # noqa: BLE001
                    traceback.print_exc()
                    generated_field = {"status": "error", "error": f"Não foi possível gerar a cifra: {exc}"[:300]}
        if cifra is None or not any(e.chords for e in cifra.events):
            raise ValueError("Não foi possível reconhecer os acordes deste áudio")
        res_align = align(cifra, a, words=words or None)

        analysis_path = f"playbacks/{uid}/analysis/{playback_id}.npz"
        bucket.blob(analysis_path).upload_from_string(analysis_bytes(a), content_type="application/octet-stream")
        uploaded.append(analysis_path)
        words_path = None
        if words:
            words_path = f"playbacks/{uid}/analysis/{playback_id}.words.json"
            bucket.blob(words_path).upload_from_string(words_bytes(words, model_name or ""),
                                                       content_type="application/json")
            uploaded.append(words_path)

        if not ref.get().exists:  # playback apagado durante o processamento
            for p in uploaded:
                bucket.blob(p).delete()
            return 0
        update({
            **result_fields(cifra, html, a, res_align),
            "stage": None, "progress": 1.0,
            "analysisPath": analysis_path, "wordsPath": words_path, "voiceWords": len(words),
            "stems": stems_field,
            **({"generated": generated_field} if generated_field else {}),
            **({"chordsPath": chords_path} if chords_path else {}),
            "chordsJob": None,
        })
        print(f"pronto em {time.monotonic() - t0:.1f}s")
        return 0
    except Exception as exc:  # noqa: BLE001 — o erro vai para o app mostrar
        traceback.print_exc()
        try:
            if ref.get().exists:
                update({"status": "error", "stage": None, "error": (str(exc) or exc.__class__.__name__)[:300]})
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    pid = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PLAYBACK_ID", "")
    if not pid:
        print("uso: python worker.py <playbackId>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(pid))
