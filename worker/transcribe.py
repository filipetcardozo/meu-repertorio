"""
Reconhecimento da letra na faixa de voz (faster-whisper, CPU, int8), com o tempo de cada palavra.
Serve ao alinhamento (functions/playback_sync/lyrics.py): é a letra que separa partes com a mesma
harmonia (verso e refrão iguais nos acordes, refrões repetidos).
"""
from __future__ import annotations

import os
from math import gcd
from typing import Callable

import numpy as np

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_DIR = os.environ.get("WHISPER_DIR", "/models/whisper")
SR_IN = 44100
SR_ASR = 16000

_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8",
                              cpu_threads=os.cpu_count() or 4, download_root=WHISPER_DIR)
    return _model


def to_16k_mono(wav: np.ndarray, sr: int = SR_IN) -> np.ndarray:
    from scipy.signal import resample_poly

    y = wav.mean(axis=0) if wav.ndim == 2 else wav
    g = gcd(sr, SR_ASR)
    y = resample_poly(y.astype(np.float32), SR_ASR // g, sr // g).astype(np.float32)
    peak = float(np.abs(y).max()) if y.size else 0.0
    return y / peak * 0.9 if peak > 1e-4 else y


def transcribe(vocals: np.ndarray, on_progress: Callable[[float], None] | None = None) -> list[dict]:
    """Palavras ({start, end, word, p, seg}) da faixa de voz [2, n] a 44,1 kHz."""
    y = to_16k_mono(vocals)
    dur = len(y) / SR_ASR
    if dur < 1:
        return []
    segs, _ = get_model().transcribe(y, language="pt", word_timestamps=True, vad_filter=True,
                                     condition_on_previous_text=False, beam_size=5)
    words: list[dict] = []
    for i, s in enumerate(segs):
        for w in s.words or []:
            # seg: trecho do reconhecedor (a geração de cifra quebra as linhas da letra nele)
            words.append({"start": round(float(w.start), 2), "end": round(float(w.end), 2),
                          "word": w.word.strip(), "p": round(float(w.probability), 3), "seg": i})
        if on_progress:
            on_progress(min(1.0, float(s.end) / dur))
    return words
