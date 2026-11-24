"""
Análise do áudio (só numpy/scipy, sem modelos):

1. decodifica (mp3/wav/flac via libsndfile), mono, 22.050 Hz;
2. separa a parte harmônica da percussiva (HPSS por filtro de mediana);
3. croma: energia de cada uma das 12 notas ao longo do tempo, separado em
   agudos (acorde) e graves (baixo);
4. envelope de ataques + andamento (autocorrelação) + batidas (programação dinâmica, Ellis 2007);
5. croma médio por meio-tempo (é a "grade" em que o alinhamento trabalha).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import soundfile as sf
from scipy import ndimage, signal

SR = 22050


@dataclass
class Analysis:
    duration: float
    bpm: float
    beats: np.ndarray  # tempos (s) das batidas
    units: np.ndarray  # início (s) de cada unidade da grade (meio-tempo); len = n_units + 1
    chroma: np.ndarray  # [n_units, 12] agudos, normalizado
    bass: np.ndarray  # [n_units, 12] graves, normalizado
    energy: np.ndarray  # [n_units] energia harmônica relativa (0..1)


def load_audio(path: str) -> np.ndarray:
    y, sr = sf.read(path, dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    if sr != SR:
        g = np.gcd(int(sr), SR)
        y = signal.resample_poly(y, SR // g, int(sr) // g).astype(np.float32)
    peak = np.max(np.abs(y)) or 1.0
    return y / peak


def stft_mag(y: np.ndarray, n_fft: int, hop: int) -> np.ndarray:
    _, _, Z = signal.stft(y, fs=SR, nperseg=n_fft, noverlap=n_fft - hop, window="hann", boundary="even", padded=True)
    return np.abs(Z).astype(np.float32)  # [freq, frames]


def hpss(S: np.ndarray, width: int = 17) -> tuple[np.ndarray, np.ndarray]:
    H = ndimage.median_filter(S, size=(1, width))
    P = ndimage.median_filter(S, size=(width, 1))
    mask = H**2 / (H**2 + P**2 + 1e-10)
    return S * mask, S * (1 - mask)


def chroma_from_spec(S: np.ndarray, n_fft: int, midi_lo: int, midi_hi: int) -> np.ndarray:
    freqs = np.arange(S.shape[0]) * SR / n_fft
    with np.errstate(divide="ignore"):
        midi = 69 + 12 * np.log2(freqs / 440.0)
    W = np.zeros((12, S.shape[0]), dtype=np.float32)
    for k, m in enumerate(midi):
        if not np.isfinite(m) or m < midi_lo - 0.5 or m > midi_hi + 0.5:
            continue
        near = np.round(m)
        d = abs(m - near)
        w = max(0.0, 1.0 - 2.5 * d)  # bins entre duas notas pesam pouco
        if w > 0:
            W[int(near) % 12, k] += w
    L = np.log1p(100.0 * S)
    return W @ L  # [12, frames]


def onset_envelope(y: np.ndarray, hop: int = 512) -> np.ndarray:
    S = stft_mag(y, 2048, hop)
    L = np.log1p(1000.0 * S)
    flux = np.maximum(0.0, np.diff(L, axis=1)).sum(axis=0)
    flux = np.concatenate([[0.0], flux])
    flux -= ndimage.uniform_filter1d(flux, 32)
    flux = np.maximum(flux, 0)
    return flux / (flux.std() + 1e-9)


def estimate_tempo(onset: np.ndarray, fps: float, lo: float = 60, hi: float = 190) -> float:
    n = len(onset)
    ac = signal.fftconvolve(onset, onset[::-1], mode="full")[n - 1:]
    lags = np.arange(len(ac))
    bpms = 60.0 * fps / np.maximum(lags, 1)
    valid = (bpms >= lo) & (bpms <= hi)
    # preferência suave por andamentos perto de 110 BPM (evita dobrar/meio)
    prior = np.exp(-0.5 * (np.log2(np.maximum(bpms, 1) / 110.0) / 0.9) ** 2)
    score = np.where(valid, ac * prior, 0)
    lag = int(np.argmax(score))
    # refino parabólico
    if 1 <= lag < len(score) - 1:
        a, b, c = score[lag - 1], score[lag], score[lag + 1]
        den = a - 2 * b + c
        lag = lag + (0.5 * (a - c) / den if den else 0)
    return 60.0 * fps / lag


def track_beats(onset: np.ndarray, fps: float, bpm: float, tightness: float = 100.0) -> np.ndarray:
    period = 60.0 * fps / bpm
    n = len(onset)
    score = onset.astype(np.float64).copy()
    back = np.full(n, -1, dtype=np.int64)
    lo, hi = int(round(period / 2)), int(round(period * 2))
    offsets = np.arange(-hi, -lo + 1)
    pen = -tightness * (np.log(-offsets / period)) ** 2
    for t in range(n):
        idx = t + offsets
        ok = idx >= 0
        if not ok.any():
            continue
        cand = np.where(ok, score[np.clip(idx, 0, None)] + pen, -np.inf)
        j = int(np.argmax(cand))
        if cand[j] > 0:
            score[t] = onset[t] + cand[j]
            back[t] = idx[j]
    # termina na melhor batida perto do fim
    tail = max(1, int(period * 2))
    t = n - tail + int(np.argmax(score[-tail:]))
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    beats = np.array(beats[::-1], dtype=np.float64)
    return beats / fps


def analyze(path: str, subdiv: int = 2) -> Analysis:
    y = load_audio(path)
    duration = len(y) / SR

    hop_o = 512
    fps_o = SR / hop_o
    onset = onset_envelope(y, hop_o)
    bpm = estimate_tempo(onset, fps_o)
    beats = track_beats(onset, fps_o, bpm)
    if len(beats) < 4:
        beats = np.arange(0, duration, 60.0 / bpm)

    # estende a grade até o começo e o fim do áudio (intro/fim sem batida marcada)
    period = float(np.median(np.diff(beats)))
    pre = np.arange(beats[0] - period, -1e-6, -period)[::-1]
    post = np.arange(beats[-1] + period, duration, period)
    beats = np.concatenate([pre, beats, post])

    # meio-tempos
    units = [beats[0]]
    for a, b in zip(beats[:-1], beats[1:]):
        for k in range(1, subdiv):
            units.append(a + (b - a) * k / subdiv)
        units.append(b)
    units = np.array(units)
    if units[0] > 0.05:
        units = np.concatenate([[0.0], units])
    if units[-1] < duration - 0.05:
        units = np.concatenate([units, [duration]])

    # croma (janela longa = boa resolução nos graves)
    n_fft, hop = 8192, 1024
    S = stft_mag(y, n_fft, hop)
    S = S[: int(2600 * n_fft / SR)]  # até ~2,6 kHz
    H, _ = hpss(S)
    treble = chroma_from_spec(H, n_fft, 48, 84)  # C3..C6
    bassc = chroma_from_spec(H, n_fft, 28, 47)  # E1..B2
    frame_t = np.arange(H.shape[1]) * hop / SR
    harm_energy = np.log1p(H.sum(axis=0))

    def pool(X):
        out = np.zeros((len(units) - 1, X.shape[0]), dtype=np.float32)
        for i in range(len(units) - 1):
            m = (frame_t >= units[i]) & (frame_t < units[i + 1])
            if not m.any():
                m = np.zeros_like(frame_t, dtype=bool)
                m[min(len(frame_t) - 1, int(np.searchsorted(frame_t, units[i])))] = True
            out[i] = X[:, m].mean(axis=1)
        return out

    def norm(C):
        C = C - C.min(axis=1, keepdims=True)  # tira o "piso" de ruído
        n = np.linalg.norm(C, axis=1, keepdims=True)
        return C / np.maximum(n, 1e-9)

    ch = pool(treble)
    bs = pool(bassc)
    en = pool(harm_energy[None, :])[:, 0]
    en = (en - en.min()) / max(1e-9, en.max() - en.min())
    return Analysis(
        duration=duration,
        bpm=float(60.0 / period),
        beats=beats,
        units=units,
        chroma=norm(ch),
        bass=norm(bs),
        energy=en,
    )
