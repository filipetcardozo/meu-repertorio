"""
Worker da separação de instrumentos (Cloud Run Job `separate-stems`).

Cada execução separa UM playback: lê `playbacks/{PLAYBACK_ID}`, baixa o áudio original, roda o
Demucs e grava as faixas em Storage `playbacks/{uid}/stems/{id}/{faixa}.mp3`. O progresso e o
resultado vão para o campo `stems` do mesmo documento (o app acompanha ao vivo):

    stems = {status: 'queued'|'processing'|'ready'|'error', progress: 0..1, model, gain,
             tracks: [{name, path}], error, updatedAt}

O áudio original não é tocado: o app continua usando ele enquanto a separação roda ou se ela falhar.

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

from separate import MODEL_NAME, decode, encode_mp3, separate

STEM_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other"]


def main(playback_id: str) -> int:
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
    db = firestore.client()
    bucket = storage.bucket()
    ref = db.collection("playbacks").document(playback_id)
    snap = ref.get()
    if not snap.exists:
        print(f"playback {playback_id} não existe", file=sys.stderr)
        return 0
    data = snap.to_dict()
    uid = data["userId"]

    last = {"t": 0.0, "p": -1.0}

    def set_stems(fields: dict):
        ref.update({f"stems.{k}": v for k, v in {**fields, "updatedAt": firestore.SERVER_TIMESTAMP}.items()})

    def progress(stage_from: float, stage_to: float):
        def cb(f: float):
            p = stage_from + (stage_to - stage_from) * f
            now = time.monotonic()
            if p - last["p"] >= 0.03 and now - last["t"] >= 2:  # no máximo ~1 escrita a cada 2 s
                last.update(t=now, p=p)
                set_stems({"progress": round(p, 3)})
        return cb

    set_stems({"status": "processing", "progress": 0.0, "error": None, "model": MODEL_NAME})
    uploaded: list[str] = []
    try:
        t0 = time.monotonic()
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, os.path.basename(data["storagePath"]))
            bucket.blob(data["storagePath"]).download_to_filename(src)
            wav = decode(src)
            res = separate(wav, on_progress=progress(0.02, 0.9))
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
                progress(0.9, 1.0)((i + 1) / len(order))

        if not ref.get().exists:  # playback apagado durante a separação
            for p in uploaded:
                bucket.blob(p).delete()
            return 0
        set_stems({
            "status": "ready", "progress": 1.0, "tracks": tracks, "gain": round(res.gain, 4),
            "durationSec": round(res.duration, 2), "error": None,
        })
        print(f"pronto em {time.monotonic() - t0:.1f}s")
        return 0
    except Exception as exc:  # noqa: BLE001 — o erro vai para o app mostrar
        traceback.print_exc()
        msg = str(exc) or exc.__class__.__name__
        try:
            if ref.get().exists:
                set_stems({"status": "error", "error": f"Não foi possível separar: {msg}"[:300]})
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    pid = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PLAYBACK_ID", "")
    if not pid:
        print("uso: python worker.py <playbackId>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(pid))
