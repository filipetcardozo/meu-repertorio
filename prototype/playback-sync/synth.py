"""
Gera um playback de teste a partir de uma cifra, com os samples reais do app (public/samples),
e devolve o gabarito: em que segundo começa cada linha.

O arranjo imita um playback de karaokê: bateria, baixo, violão batendo, piano segurando o acorde
e uma "melodia guia" com notas do acorde e notas de passagem. O andamento oscila de leve
(músico de verdade não toca no metrônomo) e dá para transpor, colocar trechos que não estão
na cifra (introdução, solo) e pular partes.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
import soundfile as sf
from scipy import signal

from cifra import Chord, Cifra
from features import SR

SAMPLES = os.path.join(os.path.dirname(__file__), "..", "..", "public", "samples")
BANKS = {"violao": (40, 79), "baixo": (28, 55), "piano": (36, 84), "guitarra": (40, 79)}


@lru_cache(maxsize=None)
def note_sample(bank: str, midi: int) -> np.ndarray:
    lo, hi = BANKS[bank]
    src = min(hi, max(lo, midi))
    y, sr = sf.read(os.path.join(SAMPLES, bank, f"{src}.mp3"), dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    if sr != SR:
        g = np.gcd(sr, SR)
        y = signal.resample_poly(y, SR // g, sr // g).astype(np.float32)
    start = int(np.argmax(np.abs(y) > 0.02 * np.abs(y).max()))
    y = y[start:]
    if src != midi:  # afina a nota mais próxima
        ratio = 2 ** ((midi - src) / 12)
        y = signal.resample(y, int(len(y) / ratio)).astype(np.float32)
    return y / (np.abs(y).max() + 1e-9)


@lru_cache(maxsize=None)
def drum_sample(name: str) -> np.ndarray:
    y, sr = sf.read(os.path.join(SAMPLES, "drums", f"{name}.wav"), dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    if sr != SR:
        g = np.gcd(sr, SR)
        y = signal.resample_poly(y, SR // g, sr // g).astype(np.float32)
    return y / (np.abs(y).max() + 1e-9)


@dataclass
class Part:
    """Um trecho tocado: uma linha da cifra (event) ou acordes fora da cifra (gap)."""

    kind: str  # "event" | "gap"
    event: int | None
    chords: list[Chord]
    beats: list[float]


@dataclass
class Plan:
    order: list[tuple[str, object]]  # ("section", idx) | ("gap", [(Chord, beats), ...])
    bpm: float = 100
    transpose: int = 0
    drift: float = 0.02  # oscilação do andamento (fração)
    seed: int = 1
    skip_events: set[int] = field(default_factory=set)
    anticipate: float = 0.0  # chance de o acorde entrar meio tempo antes
    wrong: float = 0.0  # chance de o playback tocar outro acorde (relativo/com sétima) no lugar
    passing: float = 0.25  # chance de nota de passagem na melodia
    humanize: float = 0.0  # desvio de tempo de cada nota (s)
    noise: float = 0.003


def line_beats(n_chords: int, rng: np.random.Generator) -> list[float]:
    if n_chords == 1:
        return [8.0]
    if n_chords == 2:
        return [4.0, 4.0]
    if n_chords == 3:
        return [[4.0, 2.0, 2.0], [2.0, 2.0, 4.0]][int(rng.integers(2))]
    return [4.0] * n_chords


def build_parts(cifra: Cifra, plan: Plan) -> list[Part]:
    rng = np.random.default_rng(plan.seed)
    beats_of = {e.idx: line_beats(len(e.chords), rng) for e in cifra.events if e.chords}
    parts: list[Part] = []
    for kind, val in plan.order:
        if kind == "gap":
            parts.append(Part("gap", None, [c for c, _ in val], [b for _, b in val]))
            continue
        last: Chord | None = None
        for ei in cifra.sections[val].events:
            e = cifra.events[ei]
            if e.chords:
                parts.append(Part("event", ei, e.chords, beats_of[ei]))
                last = e.chords[-1]
            elif last is not None:  # letra sem acorde: segue no último acorde
                parts.append(Part("event", ei, [last], [4.0]))
    return parts


def _substitute(ch: Chord, rng) -> Chord:
    """Acorde "parecido" que o músico toca no lugar do escrito: com sétima, relativo ou com baixo."""
    from cifra import parse_chord

    names = "C C# D D# E F F# G G# A A# B".split()
    r = names[ch.root]
    minor = 3 in ch.weights and 4 not in ch.weights
    opts = [r + ("m7" if minor else "7M"), r + ("m7" if minor else "7")]
    rel = names[(ch.root + (3 if minor else 9)) % 12] + ("" if minor else "m")
    opts.append(rel)
    return parse_chord(opts[int(rng.integers(len(opts)))]) or ch


def voice(ch: Chord, shift: int, lo: int, hi: int) -> list[int]:
    pcs = sorted({(ch.root + iv + shift) % 12 for iv, w in ch.weights.items() if w >= 0.55})
    notes = []
    for m in range(lo, hi + 1):
        if m % 12 in pcs:
            notes.append(m)
    return notes[:4]


def add(buf: np.ndarray, x: np.ndarray, at: float, gain: float, dur: float | None = None):
    i = int(at * SR)
    if i >= len(buf):
        return
    if dur is not None:
        n = min(len(x), int(dur * SR))
        x = x[:n].copy()
        f = min(n, int(0.06 * SR))
        if f > 0:
            x[-f:] *= np.linspace(1, 0, f)
    n = min(len(x), len(buf) - i)
    buf[i: i + n] += gain * x[:n]


def render(cifra: Cifra, plan: Plan, out_path: str) -> dict:
    rng = np.random.default_rng(plan.seed + 7)
    parts = build_parts(cifra, plan)
    total_beats = sum(sum(p.beats) for p in parts) + 4  # + compasso final
    # tempos das batidas com andamento oscilando
    k = np.arange(int(np.ceil(total_beats)) + 8)
    phase = rng.uniform(0, 2 * np.pi)
    period = 60.0 / plan.bpm * (1 + plan.drift * np.sin(2 * np.pi * k / 48 + phase))
    beat_t = np.concatenate([[0.0], np.cumsum(period)]) + 0.6  # 0,6 s de silêncio no início

    def t_of(b: float) -> float:
        i = int(np.floor(b))
        return float(beat_t[i] + (b - i) * (beat_t[i + 1] - beat_t[i]))

    buf = np.zeros(int((t_of(total_beats) + 3) * SR), dtype=np.float32)
    truth = []
    sh = plan.transpose
    # lista plana de acordes: (acorde tocado, início, fim) em tempos
    flat = []
    b = 0.0
    for p in parts:
        first = True
        for ch, nb in zip(p.chords, p.beats):
            flat.append({"ch": ch, "b0": b, "b1": b + nb, "line": p.event if (first and p.kind == "event") else None})
            first = False
            b += nb
    for i in range(1, len(flat)):
        if flat[i]["ch"].name != flat[i - 1]["ch"].name and rng.random() < plan.anticipate:
            flat[i]["b0"] -= 0.5
            flat[i - 1]["b1"] -= 0.5
        if rng.random() < plan.wrong:
            flat[i]["ch"] = _substitute(flat[i]["ch"], rng)
    hz = lambda: float(rng.normal(0, plan.humanize)) if plan.humanize else 0.0  # noqa: E731
    for f in flat:
        ch, b0, b1 = f["ch"], f["b0"], f["b1"]
        nb = b1 - b0
        if f["line"] is not None:
            truth.append({"event": f["line"], "t": t_of(b0)})
        t0, t1 = t_of(b0), t_of(b1)
        bass_pc = (ch.bass + sh) % 12
        bass_note = 33 + ((bass_pc - 33) % 12)
        for bb in np.arange(0, nb, 2.0):
            add(buf, note_sample("baixo", bass_note), t_of(b0 + bb) + hz(), 0.55,
                dur=t_of(min(b1, b0 + bb + 2)) - t_of(b0 + bb))
        for m in voice(ch, sh, 55, 70):
            add(buf, note_sample("piano", m), t0 + hz(), 0.18, dur=t1 - t0)
        notes = voice(ch, sh, 52, 67)
        for s_ in np.arange(0, nb, 0.5):
            down = (b0 + s_) % 1 == 0
            g = 0.20 if down else 0.11
            order = notes if down else notes[::-1]
            tt = t_of(b0 + s_) + hz()
            for j, m in enumerate(order):
                add(buf, note_sample("violao", m), tt + 0.008 * j, g, dur=0.45)
        pcs = [(ch.root + iv + sh) % 12 for iv in ch.weights]
        for s_ in np.arange(0, nb, 1.0):
            if rng.random() < 0.35:
                continue
            pc = int(rng.integers(12)) if rng.random() < plan.passing else int(rng.choice(pcs))
            m = 67 + ((pc - 67) % 12)
            add(buf, note_sample("piano", m), t_of(b0 + s_) + hz(), 0.22,
                dur=t_of(min(b1, b0 + s_ + 1)) - t_of(b0 + s_))
    # bateria do começo ao fim
    for bb in range(int(np.ceil(total_beats))):
        t = t_of(bb)
        if bb % 2 == 0:
            add(buf, drum_sample("kick_v5_1"), t, 0.7)
        else:
            add(buf, drum_sample("snare_v6_1" if bb % 4 == 1 else "snare_v6_2"), t, 0.45)
        add(buf, drum_sample("hat_v4_1"), t, 0.18)
        add(buf, drum_sample("hat_v2_1"), t_of(bb + 0.5), 0.12)
    # final: acorde de tônica segurando
    last = next(p for p in reversed(parts) if p.chords).chords[-1]
    for m in voice(last, sh, 45, 70):
        add(buf, note_sample("piano", m), t_of(b), 0.25, dur=2.5)

    # "sala": reverb curto + chiado leve
    ir = rng.standard_normal(int(0.7 * SR)).astype(np.float32) * np.exp(-np.linspace(0, 7, int(0.7 * SR)))
    wet = signal.fftconvolve(buf, ir, mode="full")[: len(buf)]
    buf = buf + 0.08 * wet / (np.abs(wet).max() + 1e-9) * np.abs(buf).max()
    buf += plan.noise * rng.standard_normal(len(buf)).astype(np.float32)
    buf /= np.abs(buf).max() + 1e-9
    sf.write(out_path, (0.9 * buf).astype(np.float32), SR, format="MP3")
    return {"truth": truth, "duration": len(buf) / SR, "bpm": plan.bpm, "transpose": plan.transpose}
