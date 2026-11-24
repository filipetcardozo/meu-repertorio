"""
Banco de testes: gera playbacks com gabarito e mede o erro da sincronia.

    python bench.py            # todos os casos
    python bench.py pop-reto   # um caso
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np

from align import align
from cifra import parse_cifra, parse_chord
from features import analyze
from synth import Plan, render

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "out")


def load(name):
    return parse_cifra(open(os.path.join(HERE, "testdata", name), encoding="utf-8").read())


def sec_order(c, extra=None):
    return [("section", i) for i in range(len(c.sections))]


def cases():
    pop = load("pop-em-c.html")
    sert = load("sertanejo-em-g.html")
    C = lambda n: parse_chord(n)  # noqa: E731

    # pop: seções 0 intro, 1 parte1, 2 pré, 3 refrão, 4 parte2, 5 pré, 6 refrão(2x), 7 final
    yield "pop-reto", pop, Plan(order=[("section", i) for i in [0, 1, 2, 3, 4, 5, 6, 6, 7]], bpm=96, drift=0.02)
    yield "pop-tom+2-intro-solo", pop, Plan(
        order=[("gap", [(C("C"), 8), (C("F"), 8)]), ("section", 0), ("section", 1), ("section", 2), ("section", 3),
               ("gap", [(C("F"), 4), (C("G"), 4), (C("Em"), 4), (C("Am"), 4), (C("F"), 4), (C("G"), 4), (C("C"), 8)]),
               ("section", 4), ("section", 5), ("section", 6), ("section", 6), ("section", 7)],
        bpm=120, transpose=2, drift=0.03, seed=3)
    # sertanejo: 0 intro, 1 verso1, 2 verso2, 3 refrão, 4 solo, 5 refrão
    yield "sertanejo-corta-verso", sert, Plan(
        order=[("section", i) for i in [0, 1, 3, 4, 5, 5]], bpm=140, transpose=-3, drift=0.02, seed=5)
    yield "sertanejo-lento", sert, Plan(order=[("section", i) for i in [0, 1, 2, 3, 4, 5]], bpm=72, drift=0.04, seed=9)

    # difíceis: antecipação, tempo humano, cifra "errada" em alguns acordes, melodia com mais passagem
    hard = dict(anticipate=0.4, humanize=0.015, passing=0.4, noise=0.01)
    yield "DIFICIL-pop", pop, Plan(
        order=[("section", i) for i in [0, 1, 2, 3, 4, 5, 6, 6, 7]], bpm=104, drift=0.06, seed=11, wrong=0.15, **hard)
    yield "DIFICIL-sertanejo", sert, Plan(
        order=[("gap", [(C("G"), 8)]), *[("section", i) for i in [0, 1, 2, 3, 4, 5, 5]]],
        bpm=128, transpose=5, drift=0.05, seed=13, wrong=0.2, **hard)
    yield "MUITO-DIFICIL-pop", pop, Plan(
        order=[("section", i) for i in [0, 1, 3, 4, 5, 6, 6, 6]], bpm=88, transpose=-1, drift=0.08, seed=17,
        wrong=0.3, anticipate=0.6, humanize=0.025, passing=0.5, noise=0.02)


def evaluate(truth, pred):
    """Casa cada ocorrência verdadeira com a prevista da mesma linha mais próxima (até 4 s)."""
    used = set()
    errs, misses = [], []
    for tr in truth:
        best, bj = None, None
        for j, p in enumerate(pred):
            if j in used or p["event"] != tr["event"]:
                continue
            d = abs(p["t"] - tr["t"])
            if d <= 4.0 and (best is None or d < best):
                best, bj = d, j
        if bj is None:
            misses.append(tr)
        else:
            used.add(bj)
            errs.append(best)
    extras = [p for j, p in enumerate(pred) if j not in used and p["event"] is not None]
    errs = np.array(errs) if errs else np.array([np.inf])
    n = len(truth)
    return {
        "linhas": n,
        "<0.3s": f"{100 * np.sum(errs < 0.3) / n:.0f}%",
        "<0.7s": f"{100 * np.sum(errs < 0.7) / n:.0f}%",
        "mediana": f"{np.median(errs):.2f}s",
        "faltando": len(misses),
        "a_mais": len(extras),
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    rows = []
    for name, cifra, plan in cases():
        if only and name != only:
            continue
        path = os.path.join(OUT, f"{name}.mp3")
        info = render(cifra, plan, path)
        t0 = time.time()
        a = analyze(path)
        t1 = time.time()
        res = align(cifra, a)
        t2 = time.time()
        ev = evaluate(info["truth"], res.timeline)
        ev.update({
            "caso": name,
            "dur": f"{info['duration']:.0f}s",
            "bpm": f"{a.bpm:.0f}/{plan.bpm:.0f}",
            "tom": f"{res.transpose:+d}/{plan.transpose:+d}",
            "tempo_proc": f"{t1 - t0:.1f}+{t2 - t1:.1f}s",
        })
        rows.append(ev)
        with open(os.path.join(OUT, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump({"truth": info["truth"], "pred": res.timeline, "transpose": res.transpose}, f, indent=1)
    cols = ["caso", "dur", "bpm", "tom", "linhas", "<0.3s", "<0.7s", "mediana", "faltando", "a_mais", "tempo_proc"]
    w = {c: max(len(c), *(len(str(r[c])) for r in rows)) for c in cols}
    print("  ".join(c.ljust(w[c]) for c in cols))
    for r in rows:
        print("  ".join(str(r[c]).ljust(w[c]) for c in cols))


if __name__ == "__main__":
    main()
