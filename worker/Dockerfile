# Processamento completo de um playback (Cloud Run Job `process-playback`). Ver worker/README.md.
# Contexto do build: a RAIZ do repositório (usa functions/playback_sync, o mesmo código da sincronia).
#   docker build -f worker/Dockerfile -t meu-repertorio-worker .
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1 TORCH_HOME=/models WHISPER_DIR=/models/whisper WHISPER_MODEL=small
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pesos dos modelos embutidos na imagem (sem download a cada execução).
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/models/whisper')"

COPY functions/playback_sync ./playback_sync
COPY worker/separate.py worker/transcribe.py worker/worker.py worker/validate.py ./
ENTRYPOINT ["python", "worker.py"]
