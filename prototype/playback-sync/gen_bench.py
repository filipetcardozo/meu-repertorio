"""
Banco de testes da geração de cifra (functions/playback_sync/generate.py).

Os acordes vêm do consonance-ACE, que roda no worker (PyTorch). Aqui eles saem do gabarito dos casos
sintéticos (synth.py), no mesmo formato que o ACE devolve ({t0, t1, label} em Harte), e o banco mede
o resto do caminho: encaixe na grade de tempos, nome na notação do app (sétimas, inversões, m7(b5),
7(4)...), tom e letra.

    python gen_bench.py             # acordes, nomes e tom em todos os casos
    python gen_bench.py pop-reto    # um caso (e imprime a cifra gerada)
    python gen_bench.py letra       # letra informada + voz ruidosa: erro de início de linha
"""
from __future__ import annotations

import html as htmllib
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "functions"))

from playback_sync.cifra import parse_chord, parse_cifra  # noqa: E402
from playback_sync.features import analyze  # noqa: E402
from playback_sync.generate import align_lyrics, generate  # noqa: E402

import bench  # noqa: E402  (casos sintéticos)
from synth import Plan, render  # noqa: E402

OUT = os.path.join(HERE, "out")
IV = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"]
NOTES = "C C# D D# E F F# G G# A A# B".split()


def cases():
    yield from bench.cases()
    # sétimas (7M, m7, 7, m7(b5)), m6, 7(4), inversões (D/F#, G/B, D/C) e trocas de 1 e 2 tempos
    sev = parse_cifra(open(os.path.join(HERE, "testdata", "setimas-inversoes-em-g.html"), encoding="utf-8").read())
    C = parse_chord
    fast = [(C("C7M"), 2), (C("D7"), 2), (C("Bm7"), 1), (C("E7"), 1), (C("Am7"), 2), (C("D7(4)"), 1),
            (C("D7"), 1), (C("G7M"), 2), (C("G/B"), 2), (C("C7M"), 2), (C("Cm6"), 2), (C("G7M"), 8)]
    yield "setimas-inversoes", sev, Plan(
        order=[("section", 0), ("section", 1), ("section", 2), ("section", 1), ("section", 2), ("gap", fast)],
        bpm=92, drift=0.02, seed=21)


def segments_of(truth_chords: list[dict]) -> list[dict]:
    """Gabarito -> o que o ACE devolveria: "D:(1,3,5,b7)/b7" etc."""
    segs = []
    for c in truth_chords:
        lab = NOTES[c["root"]] + ":(" + ",".join(IV[i] for i in c["ivs"]) + ")"
        if c["bass"] != c["root"]:
            lab += "/" + IV[(c["bass"] - c["root"]) % 12]
        segs.append({"t0": c["t0"], "t1": c["t1"], "label": lab})
    return segs


def score(g, truth_chords: list[dict]) -> tuple[int, list[str]]:
    """Acordes do gabarito que saíram com nome (raiz, notas, baixo) e tempo certos; nomes errados."""
    ok, bad = 0, []
    for c in truth_chords:
        mid = (c["t0"] + c["t1"]) / 2
        est = next((x for x in g.chords if x.t0 <= mid < x.t1), None)
        p = parse_chord(est.name) if est and est.name else None
        if p and p.root == c["root"] and p.bass == c["bass"] \
                and sorted(i for i, w in p.weights.items() if w >= 0.55) == c["ivs"]:
            ok += 1
        else:
            bad.append(f"{c['t0']:.1f}s {c['name']} -> {est.name if est else None}")
    return ok, bad


def fake_words(cifra, truth_lines, chords_truth=None):
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


def lyrics_of(cifra, truth_lines):
    """Letra "da internet", na ordem cantada (com as repetições): estrofe nova a cada troca de seção."""
    out, cur, sec, last = [], [], None, -1
    for tl in truth_lines:
        e = cifra.events[tl["event"]]
        if not e.text:
            continue
        if sec is not None and (e.section != sec or e.idx <= last):
            out.append(cur)
            cur = []
        cur.append(e.text)
        sec, last = e.section, e.idx
    if cur:
        out.append(cur)
    return "\n\n".join("\n".join(b) for b in out)


def noisy(words, seed=1):
    """Voz reconhecida ruim: some 35% das palavras, 20% saem erradas e entram palavras inventadas."""
    rng = np.random.default_rng(seed)
    out = []
    for w in words:
        r = rng.random()
        if r < 0.35:
            continue
        if r < 0.55:
            w = {**w, "word": "xyz" + w["word"][::-1]}
        out.append(w)
        if rng.random() < 0.1:
            out.append({**w, "word": "inventada", "start": w["start"] + 0.1})
    return out


def run_chords(only=None, show=False) -> int:
    fails = 0
    for name, cifra, plan in cases():
        if only and name != only:
            continue
        mp3 = os.path.join(OUT, name + ".mp3")
        truth = render(cifra, plan, mp3)
        a = analyze(mp3)
        g = generate(a, segments_of(truth["chords"]), fake_words(cifra, truth["truth"]),
                     lyrics=lyrics_of(cifra, truth["truth"]))
        ok, bad = score(g, truth["chords"])
        written = [htmllib.unescape(x) for x in re.findall(r"<b>([^<]*)</b>", g.html)]
        unreadable = [w for w in written if parse_chord(w) is None]
        fails += bool(bad) + bool(unreadable)
        print(f"{name:24s} acordes certos {ok}/{len(truth['chords'])}  tom {g.tone:4s}  linhas {g.lines:3d}  "
              f"ilegíveis na cifra: {unreadable or 'nenhum'}")
        for b in bad[:5]:
            print("   ", b)
        if show:
            print("   na cifra:", " ".join(sorted(set(written))))
            print(g.html)
    return 1 if fails else 0


def run_lyrics(only=None, show=False):
    """Letra informada + voz ruidosa: a linha deve começar perto de quando é cantada."""
    errs_all = []
    for name, cifra, plan in cases():
        if only and name != only:
            continue
        mp3 = os.path.join(OUT, name + ".mp3")
        truth = render(cifra, plan, mp3)
        a = analyze(mp3)
        clean = fake_words(cifra, truth["truth"])
        blocks = align_lyrics(lyrics_of(cifra, truth["truth"]), noisy(clean), [], a)
        got = [ln.t0 for b in blocks for ln in b]
        seg_first = {}
        for w in clean:
            seg_first.setdefault(w["seg"], w["start"])
        ref = [seg_first[k] for k in sorted(seg_first)]
        n = min(len(got), len(ref))
        errs = [abs(got[i] - ref[i]) for i in range(n)]
        errs_all += errs
        print(f"{name:24s} linhas {len(got)}/{len(ref)}  "
              f"erro início de linha: mediana {np.median(errs):.2f}s, >1s em {np.mean(np.array(errs) > 1):.0%}")
        if show:
            g = generate(a, segments_of(truth["chords"]), noisy(clean), lyrics=lyrics_of(cifra, truth["truth"]))
            print(g.html)
    if errs_all:
        print(f"{'média':24s} erro mediano {np.median(errs_all):.2f}s, >1s em {np.mean(np.array(errs_all) > 1):.0%}")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg == "letra" or (arg or "").startswith("letra:"):
        run_lyrics(arg.split(":", 1)[1] if ":" in arg else None, show=":" in arg)
    else:
        sys.exit(run_chords(arg, show=bool(arg)))
