"""
Processa no PC os playbacks de PRODUÇÃO marcados para isso (testes de quem desenvolve).

O app rodando com NEXT_PUBLIC_LOCAL_WORKER=1 (scripts/dev-local.ps1) cria os playbacks com
`processor: 'local'`. Para uma conta admin, a Function não dispara o Cloud Run e marca
`localWorker: 'waiting'` (functions/main.py, _dispatch). Este programa procura esses playbacks a cada
poucos segundos e roda o worker.py (o mesmo do Cloud Run) em cada um: separação, voz, acordes e
sincronia gravam direto no Firestore e no Storage de produção, e o app mostra o andamento como sempre.

Roda na imagem local do worker, com as credenciais do gcloud do PC (Application Default Credentials):

    docker run --rm -it -v "$env:APPDATA\\gcloud:/root/.config/gcloud:ro" `
      -e GOOGLE_CLOUD_PROJECT=avid-bricolage-313721 -e GOOGLE_CLOUD_QUOTA_PROJECT=avid-bricolage-313721 `
      -e STORAGE_BUCKET=avid-bricolage-313721.appspot.com --entrypoint python meu-repertorio-worker local_listener.py

Ctrl+C para parar; um playback que estava no meio volta para a fila e é refeito na próxima vez.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

POLL_SEC = 5


def main() -> int:
    import firebase_admin
    from firebase_admin import firestore
    from google.cloud.firestore_v1.base_query import FieldFilter

    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    firebase_admin.initialize_app(options={"projectId": project} if project else None)
    db = firestore.client()
    col = db.collection("playbacks")

    # o que ficou no meio de uma execução anterior (Ctrl+C, PC desligado) volta para a fila
    for snap in col.where(filter=FieldFilter("localWorker", "==", "running")).stream():
        snap.reference.update({"localWorker": "waiting"})

    print(f"Esperando playbacks para processar no PC (projeto {project})...",
          flush=True)
    while True:
        for snap in col.where(filter=FieldFilter("localWorker", "==", "waiting")).limit(1).stream():
            pid = snap.id
            data = snap.to_dict() or {}
            kind = "só acordes" if data.get("chordsJob") else "processamento completo"
            print(f"\n== {pid} · {data.get('label') or data.get('fileName')} · {kind}", flush=True)
            snap.reference.update({"localWorker": "running"})
            t0 = time.monotonic()
            code = subprocess.call([sys.executable, "worker.py", pid])
            if snap.reference.get().exists:
                snap.reference.update({"localWorker": firestore.DELETE_FIELD})
            print(f"== {pid} terminou em {(time.monotonic() - t0) / 60:.1f} min (código {code})", flush=True)
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
