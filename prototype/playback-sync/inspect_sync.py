"""
Mostra a linha do tempo por seção (para conferir a estrutura de um playback real).

    python inspect_sync.py playback.mp3 cifra.html
"""
from __future__ import annotations

import os
import pickle
import sys

import numpy as np

from align import align
from cifra import parse_cifra
from features import analyze


def main(audio: str, cifra_path: str):
    c = parse_cifra(open(cifra_path, encoding="utf-8").read())
    cache = os.path.join(os.path.dirname(__file__), "out", os.path.splitext(os.path.basename(audio))[0] + ".analysis.pkl")
    if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(os.path.join(os.path.dirname(__file__), "features.py")):
        a = pickle.load(open(cache, "rb"))
    else:
        a = analyze(audio)
        pickle.dump(a, open(cache, "wb"))
    r = align(c, a)
    confs = [x["conf"] for x in r.timeline if x["conf"] is not None]
    print(f"transposição {r.transpose:+d} · confiança média {np.mean(confs):.2f} · "
          f"conferir {sum(x < 0.6 for x in confs)} de {len(confs)}")
    last = None
    for x in r.timeline:
        m, s = divmod(x["t"], 60)
        if x["event"] is None:
            print(f"{int(m)}:{s:04.1f}  -- fora da cifra")
            last = None
            continue
        e = c.events[x["event"]]
        sec = c.sections[e.section]
        if sec.idx != last:
            print(f"{int(m)}:{s:04.1f}  [{sec.idx:2d}] {sec.title or '-':15s} conf {x['conf']:.2f}")
            last = sec.idx


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
