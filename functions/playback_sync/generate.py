"""
Gera uma cifra a partir do áudio, no formato que o app salva (`<pre>` com acordes em `<b>` na linha
de cima e a letra embaixo), para músicas que ainda não têm cifra ou para criar uma versão feita pela
plataforma.

Entradas: a análise do áudio (features.analyze: croma, batidas), os acordes reconhecidos pelo
consonance-ACE (worker/chords_ace.py: [{t0, t1, label}] em Harte) e as palavras reconhecidas na faixa de
voz (worker/transcribe.py: {start, end, word, p, seg}). Etapas:

1. tom: perfil de Krumhansl sobre o croma da música toda (agudos + graves), com maior x relativo menor
   decidido pelos acordes;
2. acordes: cada meio-tempo da grade fica com o acorde do ACE que mais o ocupa (as trocas caem nas
   batidas) e o nome segue a notação do app (harte.py: Am7, C7M, G/B, D7(4)...), na grafia do tom;
3. letra: as palavras viram linhas (quebra nas pausas e nos trechos que o reconhecedor separou) e as
   linhas viram estrofes (quebra nas pausas longas);
4. cada troca de acorde vai em cima da palavra cantada naquele instante;
5. trechos sem voz viram linhas só de acordes ([Intro], [Solo], [Final]) e a estrofe que mais se
   repete vira [Refrão].

É um rascunho para a pessoa revisar. Só Python puro (sem PyTorch): as Functions regeneram a cifra com
os acordes guardados pelo worker.
"""
from __future__ import annotations

import html as htmllib
import re
import unicodedata
from dataclasses import dataclass, field

import numpy as np

from .features import Analysis
from .harte import chord_symbol, is_minor, parse_harte

SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
# tons escritos com bemol (maiores; os menores relativos seguem o maior)
FLAT_MAJOR_KEYS = {5, 10, 3, 8, 1, 6}  # F Bb Eb Ab Db Gb

# perfis de Krumhansl-Kessler (maior e menor), a partir da tônica
KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

MIN_UNITS = 2  # acorde com menos que isso (1 tempo) é absorvido pelo vizinho

MIN_WORD_P = 0.12  # palavra com probabilidade menor é descartada
LINE_GAP_S = 0.65  # pausa que quebra a linha
LINE_MAX_CHARS = 44
LINE_SOFT_CHARS = 30  # passou disso, quebra na primeira pausa curta
BLOCK_GAP_BARS = 2.5  # pausa (em compassos) que separa estrofes
INSTR_MIN_BARS = 2.0  # trecho sem voz com pelo menos isso (e troca de acorde) vira linha só de acordes
SOLO_MIN_BARS = 4
CHORDS_PER_LINE = 8
REFRAO_SIM = 0.5

HALLUCINATIONS = ("amara.org", "legenda", "inscreva", "obrigado por assistir")


@dataclass
class ChordSeg:
    root: int | None  # None = sem acorde
    kind: str  # "m" (terça menor), "7" (sétima menor) ou ""
    t0: float
    t1: float
    name: str = ""
    label: str = ""  # símbolo do ACE (Harte)


@dataclass
class Line:
    words: list[dict]
    t0: float
    t1: float
    text: str = ""
    starts: list[int] = field(default_factory=list)  # coluna de início de cada palavra


@dataclass
class Generated:
    html: str
    tone: str
    bpm: float
    key_root: int
    key_minor: bool
    chords: list[ChordSeg]
    lines: int
    words: int
    source: str = "voice"  # "lyrics" (letra informada, sincronizada pela voz) | "voice" (letra reconhecida)


# ---------------------------------------------------------------- tom


def estimate_key(a: Analysis) -> tuple[int, bool]:
    w = np.maximum(a.energy, 0.05)[:, None]
    prof = (a.chroma * w).sum(axis=0) + 0.6 * (a.bass * w).sum(axis=0)
    prof = (prof - prof.mean()) / (prof.std() + 1e-9)
    best, arg = -np.inf, (0, False)
    for minor, kk in ((False, KK_MAJOR), (True, KK_MINOR)):
        z = (kk - kk.mean()) / kk.std()
        for r in range(12):
            s = float(np.dot(prof, np.roll(z, r)))
            if s > best:
                best, arg = s, (r, minor)
    return arg


def chords_from_segments(a: Analysis, segments: list[dict], key_root: int, key_minor: bool) -> list[ChordSeg]:
    """Segmentos do ACE ({t0, t1, label} em Harte) -> ChordSeg na grade de meio-tempos.

    Cada meio-tempo fica com o acorde que mais o ocupa (as trocas caem nas batidas); trechos de menos de
    MIN_UNITS são absorvidos pelo vizinho mais longo. O nome segue a
    notação do app (Am7, C7M, G/B...) com a grafia do tom; "N"/"X" = sem acorde."""
    flat = (key_root if not key_minor else (key_root + 3) % 12) in FLAT_MAJOR_KEYS
    segs = sorted((float(s["t0"]), float(s["t1"]), str(s.get("label") or "N")) for s in segments or []
                  if float(s["t1"]) > float(s["t0"]))
    U = len(a.units) - 1
    if not segs or U <= 0:
        return [ChordSeg(None, "", 0.0, float(a.duration), "")]
    starts = np.array([s[0] for s in segs])
    ends = np.array([s[1] for s in segs])

    parsed: dict[str, tuple] = {}

    def info(label: str):
        if label not in parsed:
            c = parse_harte(label)
            if c is None:
                parsed[label] = (None, "", "")
            else:
                kind = "m" if is_minor(c.intervals) else "7" if 10 in c.intervals else ""
                parsed[label] = (c.root, kind, chord_symbol(c, flat))
        return parsed[label]

    example: dict[str, str] = {}  # nome -> um rótulo Harte que o originou
    unit_lab: list[str] = []
    for u in range(U):
        u0, u1 = float(a.units[u]), float(a.units[u + 1])
        acc: dict[str, float] = {}  # soma por nome: rótulos diferentes podem dar o mesmo acorde
        for k in range(int(np.searchsorted(ends, u0, side="right")), len(segs)):
            if starts[k] >= u1:
                break
            ov = min(ends[k], u1) - max(starts[k], u0)
            if ov > 0:
                nm = info(segs[k][2])[2]
                acc[nm] = acc.get(nm, 0.0) + ov
                example.setdefault(nm, segs[k][2])
        unit_lab.append(max(acc, key=acc.get) if acc else "")

    runs: list[list] = []  # [nome, u0, u1]
    for u, nm in enumerate(unit_lab):
        if runs and runs[-1][0] == nm:
            runs[-1][2] = u + 1
        else:
            runs.append([nm, u, u + 1])
    changed = True
    while changed and len(runs) > 1:
        changed = False
        for i, r in enumerate(runs):
            if r[2] - r[1] >= MIN_UNITS:
                continue
            prev = runs[i - 1] if i > 0 else None
            nxt = runs[i + 1] if i + 1 < len(runs) else None
            if prev is not None and (nxt is None or prev[2] - prev[1] >= nxt[2] - nxt[1]):
                prev[2] = r[2]
            else:
                nxt[1] = r[1]
            del runs[i]
            k = 1
            while k < len(runs):
                if runs[k][0] == runs[k - 1][0]:
                    runs[k - 1][2] = runs[k][2]
                    del runs[k]
                else:
                    k += 1
            changed = True
            break

    out = []
    for nm, u0, u1 in runs:
        t0, t1 = float(a.units[u0]), float(a.units[min(u1, len(a.units) - 1)])
        label = example.get(nm, "N") if nm else "N"
        root, kind, _ = info(label)
        out.append(ChordSeg(root, kind, t0, t1, nm, label))
    return out


def tone_name(key_root: int, key_minor: bool) -> str:
    rel = (key_root + 3) % 12 if key_minor else key_root
    names = FLAT if rel in FLAT_MAJOR_KEYS else SHARP
    return names[key_root] + ("m" if key_minor else "")


# ---------------------------------------------------------------- letra


def _norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def _clean_word(w: str) -> str:
    w = w.strip()
    w = re.sub(r"^[\"'“”«(\[]+|[\"'“”»)\]]+$", "", w)
    w = re.sub(r"[.,;:…]+$", "", w)
    return w


def build_lines(words: list[dict]) -> list[Line]:
    ws = []
    for w in sorted(words or [], key=lambda x: x["start"]):
        txt = _clean_word(str(w.get("word", "")))
        if not txt or float(w.get("p", 1)) < MIN_WORD_P:
            continue
        ws.append({**w, "word": txt, "end": min(float(w["end"]), float(w["start"]) + 1.2)})
    lines: list[Line] = []
    cur: list[dict] = []

    def flush():
        if cur:
            lines.append(Line(words=list(cur), t0=cur[0]["start"], t1=cur[-1]["end"]))
            cur.clear()

    for w in ws:
        if cur:
            gap = w["start"] - cur[-1]["end"]
            chars = sum(len(x["word"]) + 1 for x in cur)
            new_seg = w.get("seg") is not None and w.get("seg") != cur[-1].get("seg") and len(cur) >= 3
            if gap >= LINE_GAP_S or chars + len(w["word"]) > LINE_MAX_CHARS or new_seg \
                    or (chars >= LINE_SOFT_CHARS and gap >= 0.25):
                flush()
        cur.append(w)
    flush()

    good = []
    for ln in lines:
        txt = " ".join(w["word"] for w in ln.words)
        mean_p = float(np.mean([float(w.get("p", 1)) for w in ln.words]))
        if any(h in _norm(txt) for h in HALLUCINATIONS) or (mean_p < 0.3 and len(ln.words) <= 2):
            continue
        col, starts = 0, []
        for w in ln.words:
            starts.append(col)
            col += len(w["word"]) + 1
        ln.text = txt[:1].upper() + txt[1:]
        ln.starts = starts
        good.append(ln)
    return good


# ---------------------------------------------------------------- letra informada (internet / digitada)

M_MATCH, M_CLOSE, M_MISS, M_GAP = 2.0, 1.2, -1.0, -0.45


def _word_tokens(w: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", _norm(w)) if t]


def _match_score(a: str, b: str) -> float:
    if a == b:
        return M_MATCH
    if min(len(a), len(b)) >= 4 and abs(len(a) - len(b)) <= 1:
        # distância de edição <= 1 (erros comuns do reconhecedor)
        if len(a) == len(b):
            if sum(x != y for x, y in zip(a, b)) <= 1:
                return M_CLOSE
        else:
            s, lg = (a, b) if len(a) < len(b) else (b, a)
            for i in range(len(lg)):
                if lg[:i] + lg[i + 1:] == s:
                    return M_CLOSE
    return M_MISS


def _dp_align(lt: list[str], wt: list[str]) -> list[int | None]:
    """Alinha os tokens da letra (lt) com os ouvidos (wt), na ordem (Needleman-Wunsch com as pontas da
    voz livres). Devolve, para cada token da letra, o índice do token ouvido casado (ou None)."""
    n, m = len(lt), len(wt)
    if not n or not m:
        return [None] * n
    S = np.zeros((n + 1, m + 1))
    B = np.zeros((n + 1, m + 1), dtype=np.int8)  # 0 diagonal, 1 pula letra, 2 pula voz
    S[1:, 0] = M_GAP * np.arange(1, n + 1)
    B[1:, 0] = 1
    B[0, 1:] = 2  # começo da voz livre (fala na introdução, alucinação)
    for i in range(1, n + 1):
        a = lt[i - 1]
        row_prev, row = S[i - 1], S[i]
        for j in range(1, m + 1):
            d = row_prev[j - 1] + _match_score(a, wt[j - 1])
            u = row_prev[j] + M_GAP
            le = row[j - 1] + (0.0 if i == n else M_GAP)  # fim da voz livre
            if d >= u and d >= le:
                row[j], B[i, j] = d, 0
            elif u >= le:
                row[j], B[i, j] = u, 1
            else:
                row[j], B[i, j] = le, 2
    out: list[int | None] = [None] * n
    i, j = n, m
    while i > 0 and j > 0:
        b = B[i, j]
        if b == 0:
            if _match_score(lt[i - 1], wt[j - 1]) > 0:
                out[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif b == 1:
            i -= 1
        else:
            j -= 1
    return out


def _parse_lyrics(text: str) -> list[list[str]]:
    """Estrofes (separadas por linha em branco) e suas linhas."""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = htmllib.unescape(text)
    blocks: list[list[str]] = [[]]
    for raw in text.replace("\r", "").split("\n"):
        ln = re.sub(r"\s+", " ", raw).strip()
        if not ln or re.fullmatch(r"\[.*\]", ln):  # título de seção da fonte: a geração marca de novo
            if blocks[-1]:
                blocks.append([])
            continue
        blocks[-1].append(ln)
    return [b for b in blocks if b]


def _map_synced(lines_txt: list[str], synced: list[dict]) -> list[float | None]:
    """Tempo de cada linha da letra pelas linhas do LRC (casadas pelo texto, na ordem)."""
    sy = [(float(x["t"]), set(_word_tokens(str(x.get("text", ""))))) for x in synced
          if str(x.get("text", "")).strip()]
    out: list[float | None] = [None] * len(lines_txt)
    j = 0
    for i, ln in enumerate(lines_txt):
        a = set(_word_tokens(ln))
        for k in range(j, min(len(sy), j + 4)):  # procura logo à frente (o LRC pode pular linha)
            b = sy[k][1]
            if a and b and len(a & b) / len(a | b) >= 0.6:
                out[i] = sy[k][0]
                j = k + 1
                break
    return out


def align_lyrics(lyrics: str, words: list[dict], synced: list[dict], a: Analysis) -> list[list[Line]]:
    """Estrofes da letra informada, com o tempo de cada palavra: pela voz reconhecida; o que a voz não
    pegou vem das linhas sincronizadas (LRC, com o deslocamento medido) ou é interpolado."""
    blocks_txt = _parse_lyrics(lyrics)
    lines_txt = [ln for b in blocks_txt for ln in b]
    if not lines_txt:
        return []

    # palavras da letra (com a coluna na linha) e seus tokens
    lw: list[list[dict]] = []
    lt: list[str] = []
    owner: list[tuple[int, int]] = []  # token -> (linha, palavra)
    for li, ln in enumerate(lines_txt):
        ws = []
        for m in re.finditer(r"\S+", ln):
            ws.append({"word": m.group(0), "col": m.start(), "start": None, "end": None})
            for t in _word_tokens(m.group(0)):
                lt.append(t)
                owner.append((li, len(ws) - 1))
        lw.append(ws)

    heard = []
    for w in sorted(words or [], key=lambda x: x["start"]):
        for t in _word_tokens(str(w.get("word", ""))):
            heard.append((t, float(w["start"]), float(w["end"])))
    match = _dp_align(lt, [h[0] for h in heard])
    for k, j in enumerate(match):
        if j is None:
            continue
        li, wi = owner[k]
        w = lw[li][wi]
        if w["start"] is None:
            w["start"], w["end"] = heard[j][1], heard[j][2]

    # início de cada linha: pela voz; senão pelo LRC; senão interpolado entre as vizinhas
    n = len(lines_txt)
    # tempo por palavra: medido nas linhas com várias palavras casadas (vale para a música toda)
    rates = []
    for ws in lw:
        known = [(k, w["start"]) for k, w in enumerate(ws) if w["start"] is not None]
        if len(known) >= 2 and known[-1][0] > known[0][0] and known[-1][1] > known[0][1]:
            rates.append((known[-1][1] - known[0][1]) / (known[-1][0] - known[0][0]))
    g_rate = float(np.clip(np.median(rates), 0.15, 1.2)) if rates else 0.3
    t_line: list[float | None] = []
    for ws in lw:
        known = [(k, w["start"]) for k, w in enumerate(ws) if w["start"] is not None]
        if known and len(known) >= max(1, len(ws) // 3):
            k, t = known[0]
            rate = g_rate
            if len(known) >= 2 and known[-1][0] > k and known[-1][1] > t:
                rate = float(np.clip((known[-1][1] - t) / (known[-1][0] - k), 0.12, 1.5))
            t_line.append(max(0.0, t - rate * k))  # palavras antes da primeira casada
        else:
            t_line.append(None)
    if synced:
        sy = _map_synced(lines_txt, synced)
        diffs = [t_line[i] - sy[i] for i in range(n) if t_line[i] is not None and sy[i] is not None]
        off = float(np.median(diffs)) if diffs else 0.0
        for i in range(n):
            if t_line[i] is None and sy[i] is not None:
                t_line[i] = max(0.0, sy[i] + off)
    known_i = [i for i in range(n) if t_line[i] is not None]
    if not known_i:  # nada para ancorar: espalha a letra pelo trecho com harmonia
        on = np.where(a.energy > 0.2)[0]
        t0 = float(a.units[on[0]]) if len(on) else 0.0
        t1 = float(a.units[on[-1]]) if len(on) else a.duration
        t_line = [t0 + (t1 - t0) * i / n for i in range(n)]
    else:
        for i in range(n):
            if t_line[i] is not None:
                continue
            prev = max((k for k in known_i if k < i), default=None)
            nxt = min((k for k in known_i if k > i), default=None)
            if prev is not None and nxt is not None:
                t_line[i] = t_line[prev] + (t_line[nxt] - t_line[prev]) * (i - prev) / (nxt - prev)
            elif prev is not None:
                t_line[i] = t_line[prev] + 3.0 * (i - prev)
            else:
                t_line[i] = max(0.0, t_line[nxt] - 3.0 * (nxt - i))
    for i in range(1, n):  # sempre em ordem
        t_line[i] = max(t_line[i], t_line[i - 1] + 0.3)

    # tempo de cada palavra: as casadas pela voz; as outras interpoladas dentro da linha
    lines: list[Line] = []
    for i, ws in enumerate(lw):
        start = t_line[i]
        nxt = t_line[i + 1] if i + 1 < n else min(a.duration, start + 6.0)
        inside = [w for w in ws if w["start"] is not None and start - 0.5 <= w["start"] < nxt]
        last_known = max((w["end"] for w in inside), default=None)
        end = min(nxt, last_known if last_known and last_known > start else start + max(1.0, 0.32 * len(ws)))
        ids = {id(w) for w in inside}
        pts = [(-1, start)] + [(k, w["start"]) for k, w in enumerate(ws) if id(w) in ids] + [(len(ws), end)]
        out_w = []
        for k, w in enumerate(ws):
            if id(w) in ids:
                t = w["start"]
            else:
                lo = max((p for p in pts if p[0] < k), key=lambda p: p[0])
                hi = min((p for p in pts if p[0] > k), key=lambda p: p[0])
                t = lo[1] + (hi[1] - lo[1]) * (k - lo[0]) / max(1, hi[0] - lo[0])
            out_w.append({"word": w["word"], "start": float(t), "end": float(t) + 0.25})
        lines.append(Line(words=out_w, t0=start, t1=max(end, out_w[-1]["start"] + 0.25),
                          text=lines_txt[i], starts=[w["col"] for w in ws]))

    out_blocks, k = [], 0
    for b in blocks_txt:
        out_blocks.append(lines[k:k + len(b)])
        k += len(b)
    return out_blocks


# ---------------------------------------------------------------- montagem


def _chord_row(items: list[tuple[int, str]]) -> tuple[str, int]:
    """Linha de acordes (com <b>) a partir de [(coluna, nome)]; devolve (html, largura)."""
    out, col = [], 0
    for c, nm in sorted(items):
        c = max(c, col + (1 if col else 0))
        out.append(" " * (c - col))
        out.append(f"<b>{htmllib.escape(nm)}</b>")
        col = c + len(nm)
    return "".join(out), col


def _chord_list(names: list[str]) -> list[str]:
    """Sequência de acordes de um trecho sem voz, sem repetições seguidas e com "(Nx)" se o trecho
    todo for um padrão repetido. Linhas de até CHORDS_PER_LINE acordes."""
    seq = [n for i, n in enumerate(names) if n and (i == 0 or n != names[i - 1])]
    if not seq:
        return []
    for p in range(1, len(seq) // 2 + 1):
        if len(seq) % p == 0 and seq == seq[:p] * (len(seq) // p):
            reps = len(seq) // p
            body = seq[:p]
            rows = [body[i:i + CHORDS_PER_LINE] for i in range(0, len(body), CHORDS_PER_LINE)]
            txt = ["  ".join(f"<b>{htmllib.escape(n)}</b>" for n in r) for r in rows]
            if reps > 1:
                txt[-1] += f"  ({reps}x)"
            return txt
    rows = [seq[i:i + CHORDS_PER_LINE] for i in range(0, len(seq), CHORDS_PER_LINE)]
    return ["  ".join(f"<b>{htmllib.escape(n)}</b>" for n in r) for r in rows]


def _tokens(lines: list[Line]) -> set[str]:
    return {t for ln in lines for t in re.split(r"[^a-z0-9]+", _norm(ln.text)) if len(t) > 2}


def _chords_in(chords: list[ChordSeg], t0: float, t1: float, include_active: bool) -> list[ChordSeg]:
    out = []
    for c in chords:
        if not c.name:
            continue
        if t0 <= c.t0 < t1 or (include_active and c.t0 < t0 < c.t1 and c.t1 - t0 >= 0.5):
            out.append(c)
    return out


MAX_BLOCK_LINES = 6
REPEAT_LINE_SIM = 0.6


def _sim(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def split_blocks(lines: list[Line], bar: float) -> list[list[Line]]:
    """Estrofes: quebra nas pausas longas e onde a letra passa de "repetida na música" (refrão) para
    "única" (verso) e vice-versa; estrofe comprida é dividida na maior pausa, perto do meio."""
    n = len(lines)
    toks = [_tokens([ln]) for ln in lines]
    rep = [any(j != i and _sim(toks[i], toks[j]) >= REPEAT_LINE_SIM for j in range(n)) for i in range(n)]
    for i in range(1, n - 1):  # linha isolada (verso com uma frase igual ao refrão) segue os vizinhos
        if rep[i - 1] == rep[i + 1] != rep[i]:
            rep[i] = rep[i - 1]
    gaps = [lines[i + 1].t0 - lines[i].t1 for i in range(n - 1)]

    runs: list[list[int]] = [[0]]
    for i in range(1, n):
        if gaps[i - 1] >= BLOCK_GAP_BARS * bar or rep[i] != rep[i - 1]:
            runs.append([i])
        else:
            runs[-1].append(i)

    def split(run: list[int]) -> list[list[int]]:
        if len(run) <= MAX_BLOCK_LINES:
            return [run]
        mid = (len(run) - 1) / 2
        best = max(range(1, len(run) - 1), key=lambda k: gaps[run[k] - 1] - 0.02 * bar * abs(k - mid - 0.5))
        return split(run[:best]) + split(run[best:])

    return [[lines[i] for i in part] for run in runs for part in split(run)]


def assemble(chords: list[ChordSeg], lines: list[Line], a: Analysis,
             blocks: list[list[Line]] | None = None) -> tuple[str, int]:
    beat = 60.0 / max(a.bpm, 1.0)
    bar = 4 * beat
    tol = 0.35 * beat
    duration = a.duration

    out: list[str] = []
    n_lines = 0

    def instrumental(t0: float, t1: float, title: str | None, include_active: bool = False):
        names = [c.name for c in _chords_in(chords, t0, t1, include_active=include_active)]
        rows = _chord_list(names)
        if not rows:
            return
        if title:
            rows[0] = f"[{title}] {rows[0]}"
        if out and out[-1] != "":
            out.append("")
        out.extend(rows)
        out.append("")

    if not lines:  # playback sem voz: só os acordes, uma linha a cada 4 compassos, estrofes de 4 linhas
        named = [c for c in chords if c.name]
        if not named:
            return "<pre>\n</pre>", 0
        rows: list[list[str]] = []
        for c in named:
            k = int((c.t0 - named[0].t0) // (4 * bar))
            while len(rows) <= k:
                rows.append([])
            if not rows[k] or rows[k][-1] != c.name:
                rows[k].append(c.name)
        rows = [r for r in rows if r]
        for i, r in enumerate(rows):
            if i and i % 4 == 0:
                out.append("")
            out.append("  ".join(f"<b>{htmllib.escape(nm)}</b>" for nm in r))
        return "<pre>" + "\n".join(out) + "\n</pre>", 0

    if blocks is None:
        blocks = split_blocks(lines, bar)

    # refrão: a estrofe que mais se repete (por palavras em comum)
    toks = [_tokens(b) for b in blocks]
    groups: list[list[int]] = []
    for i, t in enumerate(toks):
        for g in groups:
            r = toks[g[0]]
            if t and r and len(t & r) / len(t | r) >= REFRAO_SIM:
                g.append(i)
                break
        else:
            groups.append([i])
    refrao: set[int] = set()
    rep = [g for g in groups if len(g) >= 2]
    if rep:
        best = max(rep, key=lambda g: (len(g), sum(len(blocks[i]) for i in g)))
        refrao = set(best)

    last_printed: str | None = None
    printed_until = 0.0  # até onde as trocas de acorde já foram escritas
    for bi, block in enumerate(blocks):
        start = block[0].t0
        prev_end = blocks[bi - 1][-1].t1 if bi else 0.0
        gap = start - prev_end
        if bi == 0:
            if start >= bar:
                instrumental(0.0, start - tol, "Intro", include_active=True)
        elif gap >= INSTR_MIN_BARS * bar and _chords_in(chords, printed_until, start - tol, False):
            title = "Solo" if gap >= SOLO_MIN_BARS * bar else None
            instrumental(printed_until, start - tol, title)
            last_printed = None
        if out and out[-1] != "":
            out.append("")
        if bi in refrao:
            out.append("[Refrão]")
        for li, ln in enumerate(block):
            nxt = block[li + 1].t0 if li + 1 < len(block) else (blocks[bi + 1][0].t0 if bi + 1 < len(blocks) else duration)
            # troca entre o fim da linha e a próxima: até a metade da pausa fica nesta linha,
            # depois é da próxima (vai no começo dela)
            end = min(nxt - tol, ln.t1 + 0.5 * max(0.0, nxt - ln.t1), ln.t1 + bar)
            items: list[tuple[int, str]] = []
            active = _chords_in(chords, ln.t0 - tol, ln.t0 - tol + 1e-3, include_active=True)
            head = active[0] if active else None
            if head and (li == 0 or head.name != last_printed):
                items.append((0, head.name))
                last_printed = head.name
            for c in _chords_in(chords, ln.t0 - tol + 1e-3, end, include_active=False):
                wi = 0
                for k, w in enumerate(ln.words):
                    if w["start"] <= c.t0 + tol:
                        wi = k
                if c.t0 > ln.t1 + tol:  # troca depois da última palavra: fim da linha
                    col = len(ln.text) + 1
                else:
                    col = ln.starts[wi]
                if items and items[-1][1] == c.name:
                    continue
                items.append((col, c.name))
                last_printed = c.name
            printed_until = max(printed_until, end)
            row, _ = _chord_row(items)
            if row:
                out.append(row)
            out.append(htmllib.escape(ln.text))
            n_lines += 1

    if duration - printed_until >= bar:
        instrumental(printed_until, duration, "Final")
    while out and out[-1] == "":
        out.pop()
    return "<pre>" + "\n".join(out) + "\n</pre>", n_lines


def _major_or_minor(chords: list[ChordSeg], key_root: int, key_minor: bool) -> tuple[int, bool]:
    """O perfil confunde o tom com o relativo (G e Em): decide pelo tempo de cada tônica e pelos
    acordes do começo e do fim."""
    major = (key_root + 3) % 12 if key_minor else key_root
    minor = (major + 9) % 12
    named = [c for c in chords if c.root is not None]
    if not named:
        return key_root, key_minor

    def score(root, is_minor):
        s = sum(c.t1 - c.t0 for c in named if c.root == root and (c.kind == "m") == is_minor)
        first, last = named[0], named[-1]
        tot = sum(c.t1 - c.t0 for c in named)
        for c in (first, last):
            if c.root == root and (c.kind == "m") == is_minor:
                s += 0.08 * tot
        return s

    return (minor, True) if score(minor, True) > score(major, False) else (major, False)


def generate(a: Analysis, segments: list[dict], words: list[dict] | None, lyrics: str | None = None,
             synced: list[dict] | None = None) -> Generated:
    """`lyrics`: a letra certa (da internet ou digitada; estrofes separadas por linha em branco). Com ela,
    a voz reconhecida só dá o tempo de cada palavra. `synced`: [{t, text}] (LRC), ajuda nas linhas que a
    voz não pegou. Sem `lyrics`, a letra é a reconhecida na voz (rascunho bem pior).
    `segments`: os acordes do consonance-ACE, [{t0, t1, label}] em Harte."""
    key_root, key_minor = estimate_key(a)
    chords = chords_from_segments(a, segments, key_root, key_minor)
    key_root, key_minor = _major_or_minor(chords, key_root, key_minor)
    blocks = None
    if lyrics and lyrics.strip():
        blocks = align_lyrics(lyrics, words or [], synced or [], a)
        lines = [ln for b in blocks for ln in b]
        source = "lyrics"
    else:
        lines = build_lines(words or [])
        source = "voice"
    html, n_lines = assemble(chords, lines, a, blocks)
    return Generated(html=html, tone=tone_name(key_root, key_minor), bpm=round(a.bpm, 1),
                     key_root=key_root, key_minor=key_minor, chords=chords, lines=n_lines,
                     words=sum(len(ln.words) for ln in lines), source=source)


def generated_fields(g: Generated, model: str | None = None, chord_model: str | None = None) -> dict:
    """Campo `generated` do documento do playback (`model` = reconhecedor da voz; `chordModel` = dos acordes)."""
    return {
        "lyric": g.html,
        "tone": g.tone,
        "bpm": int(round(g.bpm)),
        "lines": g.lines,
        "words": g.words,
        "lyricsSource": g.source,
        "model": model,
        "chordModel": chord_model,
        "chords": len([c for c in g.chords if c.name]),
    }
