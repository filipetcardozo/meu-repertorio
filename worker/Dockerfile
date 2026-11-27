# Processamento completo de um playback (Cloud Run Job `process-playback`). Ver worker/README.md.
# Contexto do build: a RAIZ do repositório (usa functions/playback_sync, o mesmo código da sincronia).
#   docker build -f worker/Dockerfile -t meu-repertorio-worker .                 (produção: estágio final)
#   docker build -f worker/Dockerfile --target local -t meu-repertorio-worker .  (local: + local_listener.py)
FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1 TORCH_HOME=/models WHISPER_DIR=/models/whisper WHISPER_MODEL=small
COPY worker/requirements.txt .
RUN pip install --no-cache-dir torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Pesos dos modelos embutidos na imagem (sem download a cada execução).
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/models/whisper')"
# consonance-ACE (motor de acordes experimental, MIT): checkpoint do commit fixado, conferido por SHA-256.
# Ver worker/chords_ace.py (ACE_COMMIT, CKPT_SHA256) e worker/licenses/consonance-ACE.txt.
ARG ACE_COMMIT=d17633aea4e68e616e735d09df97b97ae3428e71
ARG ACE_CKPT_SHA256=6ab1a314366fefb3d09e351ae7cb7f826a9e0718e94e7ff164df844ba7bcd954
RUN python -c "import hashlib, os, sys, urllib.request; url = 'https://raw.githubusercontent.com/andreamust/consonance-ACE/${ACE_COMMIT}/ACE/checkpoints/conformer_decomposed_smooth.ckpt'; dst = '/models/ace/conformer_decomposed_smooth.ckpt'; os.makedirs(os.path.dirname(dst), exist_ok=True); urllib.request.urlretrieve(url, dst); h = hashlib.sha256(open(dst, 'rb').read()).hexdigest(); sys.exit(0 if h == '${ACE_CKPT_SHA256}' else 'checkpoint do consonance-ACE com hash inesperado: ' + h)"

COPY functions/playback_sync ./playback_sync
COPY worker/separate.py worker/transcribe.py worker/worker.py worker/validate.py worker/chords_ace.py worker/imported.py ./
COPY worker/licenses ./licenses
ENTRYPOINT ["python", "worker.py"]

# Só para processar no PC (yarn dev:local, worker/local_listener.py). Nunca vai para produção: o Cloud
# Build usa o estágio final.
FROM base AS local
COPY worker/local_listener.py ./

# Produção (Cloud Run Job): o estágio final, igual à base.
FROM base AS prod
