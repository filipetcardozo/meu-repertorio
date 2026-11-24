"""
Alinha a cifra com o áudio.

Modelo (Viterbi semi-Markov sobre a grade de meio-tempos):
- cada acorde de cada linha da cifra é um estado, na ordem da cifra;
- cada estado dura d unidades, com custo de duração em torno do esperado (linha ≈ 2 compassos,
  dividida entre os acordes dela; linha só de acordes ≈ 1 compasso por acorde);
- entre seções o caminho pode: seguir para a próxima (normal), VOLTAR para uma seção anterior
  (repetição: "refrão 2x", "volta ao verso"; prefere a mais próxima), PULAR seções (o playback
  cortou uma parte) ou passar por um trecho "fora da cifra" (introdução/solo/final não escritos).
  Há um estado "fora da cifra" por fronteira entre seções, para ele lembrar onde a música estava;
- custo de cada unidade = -log P(acorde | croma), com softmax entre os acordes da música
  e a opção "fora da cifra";
- testa as transposições mais prováveis (playback em outro tom) e fica com a melhor;
- 2ª passada: com o tamanho real do compasso medido, a preferência de duração fica mais firme.

Saída: linha do tempo na ordem tocada — [{event, t, conf}], event=None = fora da cifra.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .cifra import Cifra
from .features import Analysis

BETA = 14.0  # contraste do softmax
GAP_MARGIN = 0.25  # "fora da cifra" = mediana da semelhança da música - margem
W_BASS = 0.3
HARMONICS = True
DMIN, DMAX = 2, 48  # duração de um acorde, em meios-tempos
GAP_DMAX = 32
J_BACK = 2.5  # voltar para uma seção anterior (+ J_BACK_DIST por seção de distância)
J_BACK_DIST = 0.15
J_SKIP = 6.0  # pular seções (+1 por seção extra pulada)
J_GAP_IN, J_GAP_OUT = 2.0, 1.0
END_ANY_STATE = 4.0  # terminar no meio de uma seção (fade out)
W_DUR_1, W_DUR_2 = 0.9, 2.5

START = -2


def GAP(g: int) -> int:  # código de estado "fora da cifra" número g
    return -10 - g


@dataclass
class Segment:
    state: int  # >= 0 acorde; <= -10 fora da cifra
    start: int
    end: int


@dataclass
class Result:
    transpose: int
    cost: float
    segments: list[Segment]
    timeline: list[dict]
    bar_scale: float


def _states(cifra: Cifra):
    st_event, st_chord, st_dur = [], [], []
    first_of_sec, last_of_sec = {}, {}
    for sec in cifra.sections:
        for ei in sec.events:
            e = cifra.events[ei]
            if not e.chords:
                continue
            # acorde repetido em seguida na mesma linha ("A2 A2") vira um só
            keep = [k for k in range(len(e.chords)) if k == 0 or e.chords[k].name != e.chords[k - 1].name]
            n = len(keep)
            per = 8.0 if not e.text else 16.0 / n
            for k in keep:
                s = len(st_event)
                st_event.append(ei)
                st_chord.append(k)
                st_dur.append(per)
                first_of_sec.setdefault(sec.idx, s)
                last_of_sec[sec.idx] = s
    secs = sorted(first_of_sec)
    return np.array(st_event), np.array(st_chord), np.array(st_dur), secs, first_of_sec, last_of_sec


def emission_costs(cifra: Cifra, a: Analysis, shift: int):
    """custo[unidade, acorde] (+ última coluna = fora da cifra)."""
    names, templates, basses = [], [], []
    for e in cifra.events:
        for c in e.chords:
            if c.name not in names:
                names.append(c.name)
                t = c.template(shift, harmonics=HARMONICS)
                templates.append(t / np.linalg.norm(t))
                basses.append((c.bass + shift) % 12)
    T = np.array(templates)
    sim = (1 - W_BASS) * (a.chroma @ T.T) + W_BASS * a.bass[:, basses]
    sim[a.energy < 0.12] *= 0.6  # silêncio/sem harmonia: favorece 'fora da cifra'
    # 'fora da cifra' calibrado por música: numa mixagem real (cheia, com voz) a semelhança com o
    # acorde certo é menor que num playback limpo; o limite acompanha a mediana desta música
    gap_sim = float(np.median(sim.max(axis=1))) - GAP_MARGIN
    gap = np.full((sim.shape[0], 1), gap_sim)
    logits = BETA * np.concatenate([sim, gap], axis=1)
    logits -= logits.max(axis=1, keepdims=True)
    logp = logits - np.log(np.exp(logits).sum(axis=1, keepdims=True))
    return -logp, {n: i for i, n in enumerate(names)}


J_BACK_SMALL = 4.0  # voltar para seção pequena é suspeito (explica qualquer coisa): + J_BACK_SMALL / nº de acordes


def _jump_matrix(K: int, sizes: list[int] | None = None, optional: list[bool] | None = None) -> np.ndarray:
    """J[de, para] entre seções; a linha K (última) é o 'início da música'.
    Pular seções opcionais (tablatura) não conta como pulo."""
    J = np.zeros((K + 1, K))
    sizes = sizes or [4] * K
    opt = optional or [False] * K

    def only_optional_between(i, j):
        return all(opt[m] for m in range(i + 1, j))

    for i in range(K):
        for j in range(K):
            if j == i + 1 or (j > i + 1 and only_optional_between(i, j)):
                J[i, j] = 0.0
            elif j <= i:
                J[i, j] = J_BACK + J_BACK_DIST * (i - j) + J_BACK_SMALL / max(1, sizes[j])
            else:
                J[i, j] = J_SKIP + 1.0 * (j - i - 2) - 0.02 * j
    J[K] = [0.0 if only_optional_between(-1, j) else J_SKIP + 1.0 * (j - 1) for j in range(K)]
    return J


def bar_position(a: Analysis, bar: int = 8, window: int = 64) -> np.ndarray:
    """Posição de cada unidade dentro do compasso (0 = cabeça do compasso).

    Estima onde cai o "1" pelas mudanças de harmonia (acordes costumam trocar na cabeça do
    compasso). A fase é estimada por janela, para aguentar uma batida perdida no meio da música."""
    X = np.concatenate([a.chroma, 0.7 * a.bass], axis=1)
    prev = np.vstack([X[:1], X[:-1]])
    nov = np.maximum(0, 1 - np.sum(X * prev, axis=1) / (np.linalg.norm(X, axis=1) * np.linalg.norm(prev, axis=1) + 1e-9))
    U = len(nov)
    k = np.ones(window) / window
    scores = np.zeros((bar, U))
    for ph in range(bar):
        ind = np.zeros(U)
        ind[ph::bar] = nov[ph::bar]
        scores[ph] = np.convolve(ind, k, mode="same")
    phase = np.argmax(scores, axis=0)
    return (np.arange(U) - phase) % bar


BAR_COST = {0: 0.0, 4: 0.25, 2: 0.6, 6: 0.6}  # cabeça, meio, tempos 2 e 4; contratempo = 1.0
W_BAR = 1.0
W_LINE = 0.3
MIX = [(0.5, 0.4), (1.0, 0.0), (2.0, 0.15), (4.0, 0.5)]  # (compassos, penalidade)


def _dur_cost(st_dur, dur_scale, w_dur, ds):
    bar = 8.0 * dur_scale
    mix = np.min([(np.log(ds / (bar * k))) ** 2 + p for k, p in MIX], axis=0)  # [D]
    line = np.log(ds[None, :] / (st_dur[:, None] * dur_scale)) ** 2  # [S, D]
    return w_dur * mix[None, :] + W_LINE * line + 0.4 * (ds[None, :] % 2)


def _viterbi(cifra: Cifra, a: Analysis, shift: int, dur_scale: float, w_dur: float):
    st_event, st_chord, st_dur, secs, first, last = _states(cifra)
    S = len(st_event)
    cost, chord_id = emission_costs(cifra, a, shift)
    U = cost.shape[0]
    sc = np.array([chord_id[cifra.events[e].chords[k].name] for e, k in zip(st_event, st_chord)])
    cum = np.zeros((S, U + 1))
    cum[:, 1:] = np.cumsum(cost[:, sc].T, axis=1)
    gcum = np.concatenate([[0.0], np.cumsum(cost[:, -1])])
    probs = np.exp(-cost)

    ds = np.arange(DMIN, DMAX + 1)
    dur_cost = _dur_cost(st_dur, dur_scale, w_dur, ds)
    pos = bar_position(a)
    bcost = np.array([W_BAR * BAR_COST.get(int(p), 1.0) for p in pos] + [0.0])  # custo de começar na unidade u
    gds = np.arange(1, GAP_DMAX + 1)
    gdur_cost = 0.02 * gds

    K = len(secs)
    G = K + 1  # gap g: depois da seção g-1 (g=0: antes de tudo)
    sec_opt = [cifra.sections[q].optional for q in secs]
    J = _jump_matrix(K, [last[q] - first[q] + 1 for q in secs], sec_opt)
    Jg = np.vstack([J[K], J[:K]]) + J_GAP_OUT  # [G, K]: gap g -> seção
    first_idx = np.array([first[q] for q in secs])
    last_idx = np.array([last[q] for q in secs])
    prev_state = np.arange(S) - 1
    nf = np.ones(S, bool)
    nf[first_idx] = False

    INF = 1e18
    best = np.full((U + 1, S), INF)
    entry = np.full((U + 1, S), INF)
    entry_from = np.full((U + 1, S), START, dtype=np.int64)
    bp_d = np.zeros((U + 1, S), dtype=np.int32)
    gbest = np.full((U + 1, G), INF)
    gentry = np.full((U + 1, G), INF)
    gentry_from = np.full((U + 1, G), START, dtype=np.int64)
    gbp_d = np.zeros((U + 1, G), dtype=np.int32)
    gcodes = np.array([GAP(g) for g in range(G)])

    def fill_entry(t):
        entry[t, nf] = best[t, prev_state[nf]]
        entry_from[t, nf] = prev_state[nf]
        # primeiros de seção: de um fim de seção ou de um 'fora da cifra'
        M = best[t, last_idx][:, None] + J[:K]  # [K, K]
        kb = np.argmin(M, axis=0)
        v = M[kb, np.arange(K)]
        MG = gbest[t][:, None] + Jg  # [G, K]
        gb = np.argmin(MG, axis=0)
        vg = MG[gb, np.arange(K)]
        use_g = vg < v
        entry[t, first_idx] = np.where(use_g, vg, v)
        entry_from[t, first_idx] = np.where(use_g, gcodes[gb], last_idx[kb])
        if t == 0:
            entry[0, first_idx] = J[K]
            entry_from[0, first_idx] = START
        # 'fora da cifra' g: do fim da seção g-1, ou continuando
        from_sec = np.concatenate([[INF], best[t, last_idx] + J_GAP_IN])
        cont = gbest[t]
        use_c = cont < from_sec
        gentry[t] = np.where(use_c, cont, from_sec)
        gentry_from[t] = np.where(use_c, gcodes, np.concatenate([[START], last_idx]))
        if t == 0:
            gentry[0, 0] = 0.0
            gentry_from[0, 0] = START

    fill_entry(0)
    for t in range(1, U + 1):
        dd = ds[ds <= t]
        if len(dd):
            starts = t - dd
            cand = entry[starts].T + (cum[:, t][:, None] - cum[:, starts]) + dur_cost[:, : len(dd)] + bcost[starts][None, :]
            j = np.argmin(cand, axis=1)
            best[t] = cand[np.arange(S), j]
            bp_d[t] = dd[j]
        gd = gds[gds <= t]
        gstarts = t - gd
        gc = gentry[gstarts] + (gcum[t] - gcum[gstarts])[:, None] + gdur_cost[: len(gd), None]
        jg = np.argmin(gc, axis=0)
        gbest[t] = gc[jg, np.arange(G)]
        gbp_d[t] = gd[jg]
        fill_entry(t)

    # fim: no fim da última seção (0), de outra seção (1), no meio (4) ou num 'fora da cifra'
    end_cost = best[U] + END_ANY_STATE
    end_cost[last_idx] = best[U, last_idx] + 1.0
    for i in range(K):  # fim de seção depois da qual só sobra tablatura = fim normal
        if all(sec_opt[i + 1:]):
            end_cost[last_idx[i]] = best[U, last_idx[i]]
    gend = gbest[U] + END_ANY_STATE
    gend[-1] = gbest[U, -1] + 0.5
    s_end = int(np.argmin(end_cost))
    total = float(end_cost[s_end])
    g_end = int(np.argmin(gend))
    if gend[g_end] < total:
        s_end, total = GAP(g_end), float(gend[g_end])

    segs: list[Segment] = []
    t, s = U, s_end
    while t > 0:
        if s <= -10:
            g = -10 - s
            d = int(gbp_d[t, g])
            frm = gentry_from[t - d, g]
        else:
            d = int(bp_d[t, s])
            frm = entry_from[t - d, s]
        segs.append(Segment(s, t - d, t))
        t -= d
        if frm == START:
            break
        s = int(frm)
    segs.reverse()
    return total / U, segs, (st_event, st_chord, st_dur), probs, sc


def _timeline(cifra: Cifra, a: Analysis, segs, states, probs, sc) -> list[dict]:
    st_event, st_chord, _ = states
    units = a.units
    out: list[dict] = []
    i = 0
    while i < len(segs):
        sg = segs[i]
        if sg.state < 0:
            if out and out[-1]["event"] is None:
                out[-1]["end"] = float(units[sg.end])
            else:
                out.append({"event": None, "t": float(units[sg.start]), "end": float(units[sg.end]), "conf": None})
            i += 1
            continue
        e = int(st_event[sg.state])
        j = i
        group = []
        while j < len(segs) and segs[j].state >= 0 and st_event[segs[j].state] == e and (
            j == i or st_chord[segs[j].state] > st_chord[segs[j - 1].state]
        ):
            group.append(segs[j])
            j += 1
        conf = float(np.mean([probs[g.start:g.end, sc[g.state]].mean() for g in group]))
        ev = cifra.events[e]
        sec = cifra.sections[ev.section]
        pos = sec.events.index(e)
        followers = []
        for ei in sec.events[pos + 1:]:
            if cifra.events[ei].chords:
                break
            followers.append(ei)
        out.append({"event": e, "t": float(units[group[0].start]), "conf": conf})
        if followers:  # letra sem acorde em cima: divide o último acorde da linha
            last = group[-1]
            n = len(followers) + 1
            for k, fe in enumerate(followers, start=1):
                tu = last.start + (last.end - last.start) * k / n
                out.append({"event": fe, "t": float(np.interp(tu, np.arange(len(units)), units)), "conf": conf})
        i = j
    return out


def key_candidates(cifra: Cifra, a: Analysis, top: int = 3) -> list[int]:
    hist = np.zeros(12)
    for e in cifra.events:
        for c in e.chords:
            hist += c.template(0)
    hist /= np.linalg.norm(hist)
    prof = (a.chroma * a.energy[:, None]).sum(axis=0) + 0.5 * (a.bass * a.energy[:, None]).sum(axis=0)
    prof /= np.linalg.norm(prof)
    scores = np.array([float(np.roll(hist, k) @ prof) for k in range(12)])
    order = np.argsort(scores)[::-1][:top]
    # só os quase empatados com o melhor (tons vizinhos no ciclo de quintas costumam empatar)
    return [int(k) for k in order if scores[k] >= scores[order[0]] - 0.03]


def align(cifra: Cifra, a: Analysis, transpose: int | None = None) -> Result:
    shifts = [transpose % 12] if transpose is not None else key_candidates(cifra, a)
    best = None
    for k in shifts:
        cost, segs, states, probs, sc = _viterbi(cifra, a, k, 1.0, W_DUR_1)
        if best is None or cost < best[0]:
            best = (cost, k, segs, states)
    _, k, segs, states = best

    # 2ª passada: duração esperada na escala real desta música, e preferência mais firme
    ratios = [(g.end - g.start) / states[2][g.state] for g in segs if g.state >= 0]
    scale = float(np.clip(np.median(ratios), 0.4, 2.5)) if ratios else 1.0
    for cand in (0.5, 1.0, 2.0):  # encaixa em dobro/metade quando estiver perto
        if abs(scale / cand - 1) < 0.2:
            scale = cand
    cost, segs, states, probs, sc = _viterbi(cifra, a, k, scale, W_DUR_2)

    tl = _timeline(cifra, a, segs, states, probs, sc)
    return Result(transpose=(k + 6) % 12 - 6, cost=cost, segments=segs, timeline=tl, bar_scale=scale)
