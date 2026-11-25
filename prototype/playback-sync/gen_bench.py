"""
Banco de testes da geração de cifra (functions/playback_sync/generate.py).

Sintéticos (synth.py, com gabarito de cada acorde): mede o acerto de acorde por tempo (fundamental +
maior/menor) e o tom. Real (Refém, análise guardada em out/): compara com a sincronia conferida.

    python gen_bench.py             # todos
    python gen_bench.py pop-reto    # um caso (e imprime a cifra gerada)
"""
from __future__ import annotations

import json
import os
import pickle
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "functions"))

from playback_sync.cifra import parse_chord  # noqa: E402
from playback_sync.features import Analysis, analyze  # noqa: E402
from playback_sync.generate import generate  # noqa: E402

import bench  # noqa: E402  (casos sintéticos)
from synth import render  # noqa: E402

OUT = os.path.join(HERE, "out")


def acc(g, truth, step=0.1, t_end=None):
    """Fração do tempo (com acorde no gabarito) em que fundamental e maior/menor batem."""
    t_end = t_end or max(c["t1"] for c in truth)
    ok = tot = 0
    for t in np.arange(0, t_end, step):
        tr = next((c for c in truth if c["t0"] <= t < c["t1"]), None)
        if tr is None:
            continue
        gs = next((c for c in g.chords if c.t0 <= t < c.t1), None)
        tot += 1
        if gs and gs.root is not None and gs.root == tr["root"] and (gs.kind == "m") == tr["minor"]:
            ok += 1
    return ok / max(tot, 1)


def fake_words(cifra, truth_lines, chords_truth):
    """Palavras "cantadas" com o tempo do gabarito (testa a montagem sem o Whisper)."""
    words = []
    for i, tl in enumerate(truth_lines):
        e = cifra.events[tl["event"]]
        if not e.text:
            continue
        t0 = tl["t"]
        t1 = truth_lines[i + 1]["t"] if i + 1 < len(truth_lines) else t0 + 3
        ws = e.text.split()
        span = (t1 - t0) * 0.8
        for k, w in enumerate(ws):
            s = t0 + 0.1 + span * k / len(ws)
            words.append({"start": round(s, 2), "end": round(s + span / len(ws) * 0.9, 2), "word": w, "p": 0.9, "seg": i})
    return words


def run_synth(only=None, show=False):
    res = []
    for name, cifra, plan in bench.cases():
        if only and name != only:
            continue
        mp3 = os.path.join(OUT, name + ".mp3")
        truth = render(cifra, plan, mp3)
        a = analyze(mp3)
        words = fake_words(cifra, truth["truth"], truth["chords"])
        g = generate(a, words)
        sc = acc(g, truth["chords"])
        res.append(sc)
        print(f"{name:28s} acordes {sc:5.1%}  tom {g.tone:4s}  linhas {g.lines}")
        if show:
            print(g.html)
    if res:
        print(f"{'média':28s} acordes {np.mean(res):5.1%}")


def run_refem(show=False):
    pkl = os.path.join(OUT, "Dilsinho - Refém.analysis.pkl")
    js = os.path.join(OUT, "refem-sync.sync.json")
    if not (os.path.exists(pkl) and os.path.exists(js)):
        return
    raw = pickle.load(open(pkl, "rb"))
    a = Analysis(**{k: getattr(raw, k) for k in ("duration", "bpm", "beats", "units", "chroma", "bass", "energy")})
    d = json.load(open(js, encoding="utf-8"))
    sh = d["transpose"]
    truth = []
    tl = d["timeline"]
    for i, it in enumerate(tl):
        if not it.get("chords"):
            continue
        t0 = it["t"]
        t1 = tl[i + 1]["t"] if i + 1 < len(tl) else d["duration"]
        n = len(it["chords"])
        for k, nm in enumerate(it["chords"]):
            c = parse_chord(nm)
            if c is None:
                continue
            truth.append({"root": (c.root + sh) % 12, "minor": 3 in c.weights and 4 not in c.weights,
                          "t0": t0 + (t1 - t0) * k / n, "t1": t0 + (t1 - t0) * (k + 1) / n})
    g = generate(a, None)
    print(f"{'REAL Refém (sem voz)':28s} acordes {acc(g, truth):5.1%}  tom {g.tone:4s} (gabarito ~Cm/Eb)")
    if show:
        print(g.html)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg == "refem":
        run_refem(show=True)
    else:
        run_synth(arg, show=bool(arg))
        if not arg:
            run_refem()
