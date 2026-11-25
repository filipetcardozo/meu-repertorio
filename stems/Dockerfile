# Worker da separação de instrumentos (Cloud Run Job). Ver stems/README.md.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1 TORCH_HOME=/models
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pesos do modelo embutidos na imagem (sem download a cada execução).
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"

COPY separate.py worker.py validate.py ./
ENTRYPOINT ["python", "worker.py"]
