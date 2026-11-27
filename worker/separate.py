"""
Separação de instrumentos com o Demucs (modelo experimental de 6 faixas `htdemucs_6s`).

Só áudio, sem Firebase: decodifica qualquer formato com o ffmpeg, separa e grava cada faixa em mp3.
Usado pelo worker (worker.py) e pela validação local (validate.py).

Limite do modelo: ele separa por CATEGORIA de instrumento. Guitarra base e solo de guitarra (e violão)
saem juntos na faixa "guitar"; não há como desligar só o solo.
"""
from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from typing import Callable

import numpy as np

MODEL_NAME = os.environ.get("STEMS_MODEL") or "htdemucs_6s"
SR = 44100  # taxa do modelo
MP3_BITRATE = os.environ.get("STEMS_MP3_BITRATE", "160k")

_model = None


def get_model():
    """Carrega o modelo uma vez por processo (os pesos vêm embutidos na imagem, em $TORCH_HOME)."""
    global _model
    if _model is None:
        import torch
        from demucs.pretrained import get_model as _get

        torch.set_num_threads(max(1, os.cpu_count() or 1))
        _model = _get(MODEL_NAME)
        _model.eval()
    return _model


def decode(path: str, min_seconds: float = 1.0) -> np.ndarray:
    """Qualquer formato -> float32 [2, n] a 44,1 kHz (ffmpeg)."""
    out = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    wav = np.frombuffer(out, dtype=np.float32).reshape(-1, 2).T.copy()
    if wav.shape[1] < SR * min_seconds:
        raise ValueError("Áudio curto demais para separar.")
    return wav


def encode_mp3(wav: np.ndarray, path: str) -> None:
    """float32 [2, n] -> mp3 (o ffmpeg grava o cabeçalho LAME com o atraso do codificador: sem defasagem)."""
    data = np.ascontiguousarray(wav.T, dtype=np.float32).tobytes()
    subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-",
         "-c:a", "libmp3lame", "-b:a", MP3_BITRATE, path],
        input=data, check=True,
    )


@dataclass
class StemsResult:
    names: list[str]
    stems: np.ndarray  # [n_stems, 2, n] float32, já na escala de saída
    gain: float  # quanto o app deve multiplicar a soma das faixas para voltar ao volume original
    duration: float


def _patch_progress(cb: Callable[[float], None] | None):
    """O apply_model do Demucs só informa progresso pelo tqdm: troca por um que chama `cb`."""
    import demucs.apply as dapply

    class _Tqdm:
        def __init__(self, iterable, **_kw):
            self.it = list(iterable)

        def __iter__(self):
            n = len(self.it) or 1
            for i, x in enumerate(self.it):
                yield x
                if cb:
                    cb((i + 1) / n)

    class _Mod:
        tqdm = _Tqdm

    dapply.tqdm = _Mod


def _output_scale(stems: np.ndarray) -> float:
    """Uma escala só para todas as faixas (evita clipar no mp3 sem mudar o equilíbrio entre elas)."""
    peak = float(np.max(np.abs(stems))) or 1.0
    return min(1.0, 0.98 / peak)


def separate(wav: np.ndarray, on_progress: Callable[[float], None] | None = None) -> StemsResult:
    import torch
    from demucs.apply import apply_model

    model = get_model()
    _patch_progress(on_progress)
    x = torch.from_numpy(wav)
    ref = x.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    x = (x - mean) / std
    with torch.no_grad():
        out = apply_model(model, x[None], shifts=1, split=True, overlap=0.25, progress=True, device="cpu")[0]
    out = out * std + mean
    stems = out.numpy().astype(np.float32)

    scale = _output_scale(stems)  # o app desfaz com `gain`
    stems *= scale
    return StemsResult(names=list(model.sources), stems=stems, gain=1.0 / scale, duration=wav.shape[1] / SR)
