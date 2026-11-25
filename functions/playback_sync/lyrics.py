"""
Custo de letra para o alinhamento: compara as palavras reconhecidas na faixa de voz (Whisper, com
tempo por palavra) com a letra de cada linha da cifra.

Os acordes sozinhos não distinguem partes com a mesma harmonia (verso e refrão de "Falta Você",
refrões repetidos); a letra distingue. O custo entra somado ao dos acordes, por unidade da grade:
numa unidade em que se ouviu uma palavra marcante, a linha que tem essa palavra fica barata e as
outras ficam caras. Onde não há voz o custo é zero e manda só a harmonia.
"""
from __future__ import annotations

import math
import re
import unicodedata

import numpy as np

from .cifra import Cifra
from .features import Analysis

# peso do custo de letra (o de acorde é -log p, ~1–3 por unidade). Medido com Falta Você, Cheia de
# Manias e Refém (playback sem voz): 2 → 35/48 linhas com a letra ouvida no trecho; 3 → 40/48; 5 → 42/48,
# sem mudar a Refém.
W_LYRIC = 5.0
TOL_S = 0.25  # folga ao pôr a palavra na grade
MIN_P = 0.3  # palavras com probabilidade menor que isso são ignoradas (alucinação do reconhecedor)
MAX_WORD_S = 1.2  # palavra "esticada" (o reconhecedor às vezes dá 20 s a uma palavra): só o começo conta


def tokens(text: str) -> list[str]:
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return [w for w in re.split(r"[^a-z0-9]+", t) if w]


def _close(a: str, b: str) -> bool:
    """Distância de edição <= 1 (palavras de 4+ letras): erros comuns do reconhecedor."""
    if a == b:
        return True
    if min(len(a), len(b)) < 4 or abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) <= 1
    if len(a) > len(b):
        a, b = b, a
    i = 0
    while i < len(a) and a[i] == b[i]:
        i += 1
    return a[i:] == b[i + 1:]


def event_tokens(cifra: Cifra) -> list[set[str]]:
    """Palavras de cada evento + as das linhas sem acorde que vêm logo depois (cantadas sobre o
    mesmo acorde)."""
    out: list[set[str]] = [set() for _ in cifra.events]
    for sec in cifra.sections:
        owner = None
        for ei in sec.events:
            e = cifra.events[ei]
            if e.chords:
                owner = ei
            if e.text and owner is not None:
                out[owner].update(tokens(e.text))
    return out


def lyric_costs(cifra: Cifra, a: Analysis, words: list[dict], st_event: np.ndarray,
                weight: float | None = None) -> np.ndarray:
    """Custo [unidade, estado] (estado = acorde de um evento, como no alinhador)."""
    weight = W_LYRIC if weight is None else weight
    units = a.units
    U = len(units) - 1
    S = len(st_event)
    L = np.zeros((U, S))
    if not words or not S:
        return L

    ev_tok = event_tokens(cifra)
    lines = [t for t in ev_tok if t]
    if not lines:
        return L
    df: dict[str, int] = {}
    for t in lines:
        for w in t:
            df[w] = df.get(w, 0) + 1
    idf = {w: math.log(1 + len(lines) / n) for w, n in df.items()}
    top = max(idf.values())

    def weight_of(w: str) -> float:
        # palavra que não está na cifra também conta como "ouvi alguma coisa": peso médio
        x = idf.get(w, 0.5 * top) / top
        return x * (0.5 if len(w) <= 2 else 1.0)

    # palavras por unidade
    per_unit: list[list[tuple[str, float]]] = [[] for _ in range(U)]
    for wd in words:
        if wd.get("p", 1.0) < MIN_P:
            continue
        end = min(wd["end"], wd["start"] + MAX_WORD_S)
        for w in tokens(wd["word"]):
            u0 = max(0, int(np.searchsorted(units, wd["start"] - TOL_S, side="right")) - 1)
            u1 = min(U, int(np.searchsorted(units, end + TOL_S, side="left")))
            for u in range(u0, max(u0 + 1, u1)):
                per_unit[u].append((w, math.sqrt(wd.get("p", 1.0)) * weight_of(w)))

    uniq_events = sorted(set(int(e) for e in st_event))
    col = {e: np.where(st_event == e)[0] for e in uniq_events}
    for u, ws in enumerate(per_unit):
        if not ws:
            continue
        pres = max(x for _, x in ws)
        for e in uniq_events:
            te = ev_tok[e]
            m = 0.0
            if te:
                for w, x in ws:
                    if w in te:
                        m = max(m, x)
                    elif len(w) >= 4 and any(_close(w, t) for t in te):
                        m = max(m, 0.8 * x)
            L[u, col[e]] = weight * (pres - m)
    return L
