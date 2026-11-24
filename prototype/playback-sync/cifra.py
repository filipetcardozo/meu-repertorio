"""
Lê a cifra no formato que o app salva (`<pre>` com acordes em `<b>`) e monta a estrutura
usada no alinhamento:

- seções (blocos separados por título "[Refrão]" ou linha em branco);
- eventos: cada linha com acordes (linha de acordes + a letra logo abaixo, ou só acordes, como
  na introdução) e as linhas de letra sem acorde em cima;
- para cada acorde, as notas (classes de altura 0..11) e o baixo.

Em produção, isso viria do próprio app (parseChord.ts + domLines.ts), mandado junto com o mp3.
"""
from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
CHORD_RE = re.compile(
    r"^([A-G])([#b]?)((?:m(?!aj)|maj|min|dim|aug|sus|add|M|°|º|ø|\+|-|[0-9]|\([^)]*\))*)(?:/([A-G][#b]?|[0-9]+))?$"
)
SECTION_RE = re.compile(
    r"^(intro|introdu[cç][aã]o|refr[aã]o|pr[eé]-?refr[aã]o|ponte|solo|final|verso|parte|primeira parte|"
    r"segunda parte|terceira parte|riff|interl[uú]dio|coro|bridge|chorus|verse|outro)\b",
    re.I,
)
REPEAT_RE = re.compile(r"\(\s*(\d+)\s*x\s*\)|\bx\s*(\d+)\b|\b(\d+)\s*x\b", re.I)


@dataclass
class Chord:
    name: str
    root: int
    bass: int
    # peso de cada classe de altura (0..11) relativo à raiz
    weights: dict[int, float]

    def template(self, shift: int = 0, harmonics: bool = False):
        """Notas do acorde (0..11). Com `harmonics`, soma os harmônicos de cada nota
        (3º = quinta, 5º = terça maior...), como o croma de um instrumento de verdade mostra."""
        import numpy as np

        v = np.zeros(12)
        partials = [(0, 1.0), (7, 0.55), (4, 0.3), (10, 0.15)] if harmonics else [(0, 1.0)]
        for iv, w in self.weights.items():
            for off, hw in partials:
                v[(self.root + iv + off + shift) % 12] += w * hw
        return v


def note_pc(n: str) -> int | None:
    if not n or n[0] not in NOTE_INDEX:
        return None
    pc = NOTE_INDEX[n[0]]
    for a in n[1:]:
        pc += 1 if a == "#" else -1 if a == "b" else 0
    return pc % 12


def parse_chord(raw: str) -> Chord | None:
    name = raw.strip().strip("|,.;:")
    if name.startswith("(") and name.endswith(")"):
        name = name[1:-1]
    elif name.endswith(")") and "(" not in name:
        name = name[:-1]
    elif name.startswith("(") and ")" not in name:
        name = name[1:]
    m = CHORD_RE.match(name)
    if not m:
        return None
    root = note_pc(m.group(1) + m.group(2))
    q = m.group(3) or ""
    ql = q.lower()

    minor = bool(re.match(r"^(m(?!aj)|min|-)", q)) and not q.startswith("M")
    third = 3 if minor else 4
    fifth = 7
    w: dict[int, float] = {0: 1.0}

    if "°" in q or "º" in q or "dim" in ql:
        third, fifth = 3, 6
        if "7" in q:
            w[9] = 0.6
    elif "ø" in q or re.search(r"b5|5-|5b", q):
        fifth = 6
    if "+" in q or "aug" in ql or "#5" in q:
        fifth = 8

    power = re.fullmatch(r"5", q) is not None
    sus4 = "sus4" in ql or re.search(r"(^|[^0-9b#])4($|\))", q) is not None
    sus2 = "sus2" in ql or re.fullmatch(r"2", q) is not None

    if power:
        w[7] = 0.9
    else:
        if sus4:
            w[5] = 0.85
        elif sus2:
            w[2] = 0.85
        else:
            w[third] = 0.9
        w[fifth] = 0.8

    if re.search(r"7M|maj7|M7|\(7M\)", q):
        w[11] = 0.6
    elif "7" in q and not ("°" in q or "º" in q or "dim" in ql):
        w[10] = 0.6
    if re.search(r"(^|[^0-9b#])6", q):
        w[9] = 0.55
    if re.search(r"(^|[^0-9b#])9|add9|add2", q):
        w[2] = max(w.get(2, 0), 0.4)

    bass = root
    b = m.group(4)
    if b:
        bp = note_pc(b) if b[0].isalpha() else None
        if bp is not None:
            bass = bp
            iv = (bass - root) % 12
            w[iv] = max(w.get(iv, 0), 0.7)
    return Chord(name=name, root=root, bass=bass, weights=w)


@dataclass
class Event:
    """Uma linha da cifra que entra na linha do tempo."""

    idx: int
    section: int
    chords: list[Chord]
    text: str  # letra (vazia em linha só de acordes)
    lyric_idx: int | None  # índice da linha de letra (mesma ordem do domLines.ts)
    repeat: int = 1  # "(2x)" escrito na linha


@dataclass
class Section:
    idx: int
    title: str
    events: list[int] = field(default_factory=list)
    repeat: int = 1
    # bloco de tablatura: no Cifra Club costuma ser a mesma parte escrita de outro jeito
    # (ex.: a introdução em acordes e depois em tablatura), então pular não custa nada
    optional: bool = False


@dataclass
class Cifra:
    sections: list[Section]
    events: list[Event]

    def chorded_events(self):
        return [e for e in self.events if e.chords]


def _split_bold(line: str):
    """[(texto, é_negrito)] de uma linha com <b>."""
    parts = re.split(r"(<b\b[^>]*>.*?</b>)", line, flags=re.I)
    out = []
    for p in parts:
        if not p:
            continue
        bold = re.match(r"<b\b", p, re.I) is not None
        txt = re.sub(r"<[^>]+>", "", p)
        out.append((html.unescape(txt).replace("\xa0", " ").replace("​", ""), bold))
    return out


def parse_cifra(src: str) -> Cifra:
    body = re.sub(r"(?is)^.*?<pre[^>]*>|</pre>.*$", "", src)
    body = re.sub(r"(?i)<br\s*/?>", "\n", body)
    body = re.sub(r"(?i)<(/?)strong\b", r"<\1b", body)
    # como o cleanCifraHtml do app: <b ...> vira <b> (atributos podem ter quebra de linha)
    # e as outras tags (div, span...) saem
    body = re.sub(r"(?i)<b\b[^>]*>", "<b>", body)
    body = re.sub(r"(?i)<(?!/?b>)[^>]*>", "", body)
    raw_lines = body.split("\n")

    sections: list[Section] = []
    events: list[Event] = []
    lyric_counter = 0
    cur: Section | None = None
    pending_chords: list[Chord] | None = None
    pending_repeat = 1
    pending_tab = False

    def new_section(title: str):
        nonlocal cur
        cur = Section(idx=len(sections), title=title)
        sections.append(cur)

    def flush_pending():
        nonlocal pending_chords, pending_repeat, pending_tab
        if pending_chords:
            if pending_tab and (cur is None or not cur.optional):
                new_section("Tab")
                cur.optional = True
            elif not pending_tab and (cur is None or cur.optional):
                new_section("")
            events.append(Event(len(events), cur.idx, pending_chords, "", None, pending_repeat))
            cur.events.append(events[-1].idx)
        pending_chords, pending_repeat, pending_tab = None, 1, False

    for raw in raw_lines:
        parts = _split_bold(raw)
        plain = "".join(t if not b else " " * len(t) for t, b in parts)
        bold_tokens = [tok for t, b in parts if b for tok in t.split()]

        # título de seção no começo da linha ("[Refrão]" ou "Refrão:")
        title = None
        mt = re.match(r"^\s*\[([^\]]+)\]\s*", plain)
        if mt:
            title = mt.group(1).strip()
            plain = plain[: mt.start()] + " " * (mt.end() - mt.start()) + plain[mt.end():]
        else:
            mt = re.match(r"^\s*([^\s:][^:]{0,30}):\s*", plain)
            if mt and SECTION_RE.match(mt.group(1).strip()):
                title = mt.group(1).strip()
                plain = " " * mt.end() + plain[mt.end():]

        rep_m = REPEAT_RE.search(plain)
        rep = int(next(g for g in rep_m.groups() if g)) if rep_m else 1
        plain_clean = REPEAT_RE.sub(" ", plain)
        plain_tokens = plain_clean.split()

        is_tab = re.search(r"[-=]{4,}|\|.*\|", plain_clean) is not None and not bold_tokens
        if title is not None:
            flush_pending()
            new_section(title)
            cur.repeat = rep

        if not plain_tokens and not bold_tokens:
            if title is None:
                flush_pending()
                if cur is not None and cur.events:
                    cur = None  # linha em branco fecha o bloco
            continue
        if is_tab:
            if pending_chords:
                pending_tab = True
            continue

        loose = [t for t in plain_tokens if not re.fullmatch(r"[|/\-–()x0-9.]+", t, re.I)]
        chord_line = (bold_tokens and not loose) or (
            loose and all(parse_chord(t) for t in loose) and not bold_tokens
        )
        if chord_line:
            flush_pending()
            names = bold_tokens + ([] if bold_tokens else loose)
            chords = [c for c in (parse_chord(t) for t in names) if c]
            if chords:
                pending_chords = chords
                pending_repeat = rep
            continue

        # linha de letra
        text = " ".join(plain_tokens)
        if cur is None or cur.optional:
            new_section("")
        ev = Event(len(events), cur.idx, pending_chords or [], text, lyric_counter, max(rep, pending_repeat))
        lyric_counter += 1
        events.append(ev)
        cur.events.append(ev.idx)
        pending_chords, pending_repeat, pending_tab = None, 1, False

    flush_pending()
    sections = [s for s in sections if s.events]
    for i, s in enumerate(sections):
        for e in s.events:
            events[e].section = i
        s.idx = i
    return Cifra(sections=sections, events=events)


if __name__ == "__main__":
    import sys

    c = parse_cifra(open(sys.argv[1], encoding="utf-8").read())
    for s in c.sections:
        print(f"== [{s.idx}] {s.title or '(sem título)'}" + (f"  ({s.repeat}x)" if s.repeat > 1 else ""))
        for ei in s.events:
            e = c.events[ei]
            ch = " ".join(x.name for x in e.chords)
            print(f"   {e.idx:3d} L{'' if e.lyric_idx is None else e.lyric_idx!s:>3}  [{ch:<20}] {e.text}")
