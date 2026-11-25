"""
Símbolos de acorde no padrão Harte (o que os modelos de reconhecimento devolvem: "A:min7", "C:maj7",
"G:maj/3", "D:(1,3,5,b7,9)", "N" = sem acorde) -> notação do app (cifra brasileira, a mesma que
src/utils/chords/parseChord.ts lê): Am7, C7M, G/B, D7(9), Bm7(b5), C°7, D4, A2...

Só Python puro: roda nas Functions (regenerar a cifra a partir dos segmentos guardados) sem PyTorch.

O nome é montado a partir das notas do acorde (intervalos a partir da raiz) e do baixo, e não do texto
do símbolo: assim "C:maj7", "C:(1,3,5,7)" e "C:(3,5,7)" saem todos C7M. A grafia das notas (C# ou Db)
segue o tom da música (bemóis em F, Bb, Eb...).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

# abreviações do Harte (e as que o mir_eval e o harte-library usam), em semitons a partir da raiz
SHORTHAND: dict[str, tuple[int, ...]] = {
    "maj": (0, 4, 7), "min": (0, 3, 7), "dim": (0, 3, 6), "aug": (0, 4, 8),
    "maj7": (0, 4, 7, 11), "min7": (0, 3, 7, 10), "7": (0, 4, 7, 10), "dim7": (0, 3, 6, 9),
    "hdim7": (0, 3, 6, 10), "minmaj7": (0, 3, 7, 11), "maj6": (0, 4, 7, 9), "min6": (0, 3, 7, 9),
    "9": (0, 4, 7, 10, 2), "maj9": (0, 4, 7, 11, 2), "min9": (0, 3, 7, 10, 2),
    "11": (0, 4, 7, 10, 2, 5), "maj11": (0, 4, 7, 11, 2, 5), "min11": (0, 3, 7, 10, 2, 5),
    "13": (0, 4, 7, 10, 2, 9), "maj13": (0, 4, 7, 11, 2, 9), "min13": (0, 3, 7, 10, 2, 9),
    "sus2": (0, 2, 7), "sus4": (0, 5, 7), "1": (0,), "5": (0, 7),
}
# grau do Harte -> semitons (9, 11 e 13 caem na mesma classe de altura de 2, 4 e 6)
DEGREE = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 2, 10: 4, 11: 5, 12: 7, 13: 9}
LABEL_RE = re.compile(r"^([A-G])([#b]*)(?::([^(/]*)(?:\(([^)]*)\))?)?(?:/([#b]*\d+))?$")


@dataclass
class HarteChord:
    root: int  # classe de altura (0 = C)
    intervals: frozenset[int]  # semitons a partir da raiz (0..11), com a raiz
    bass: int  # semitons a partir da raiz (0 = sem inversão)


def note_pc(n: str) -> int | None:
    if not n or n[0] not in NOTE_INDEX:
        return None
    pc = NOTE_INDEX[n[0]]
    for a in n[1:]:
        if a == "#":
            pc += 1
        elif a == "b":
            pc -= 1
        else:
            return None
    return pc % 12


def _degree(tok: str) -> int | None:
    m = re.fullmatch(r"([#b]*)(\d+)", tok.strip())
    if not m or int(m.group(2)) not in DEGREE:
        return None
    return (DEGREE[int(m.group(2))] + m.group(1).count("#") - m.group(1).count("b")) % 12


def parse_harte(label: str) -> HarteChord | None:
    """None = sem acorde ("N", "X" ou símbolo que não é Harte)."""
    s = (label or "").strip()
    if s in ("", "N", "X"):
        return None
    m = LABEL_RE.match(s)
    if not m:
        return None
    root = note_pc(m.group(1) + m.group(2))
    if root is None:
        return None
    short, extra, bass_tok = m.group(3), m.group(4), m.group(5)
    if short is None and extra is None:
        ivs = set(SHORTHAND["maj"])  # "C" = "C:maj"
    elif short:
        if short not in SHORTHAND:
            return None
        ivs = set(SHORTHAND[short])
    else:
        ivs = set()  # "C:(1,3,5)": só as notas da lista
    for tok in (extra or "").split(","):
        tok = tok.strip()
        if not tok:
            continue
        omit = tok.startswith("*")
        d = _degree(tok.lstrip("*"))
        if d is None:
            return None
        if omit:
            ivs.discard(d)
        else:
            ivs.add(d)
    bass = 0
    if bass_tok:
        d = _degree(bass_tok)
        if d is None:
            return None
        bass = d
        ivs.add(d)
    ivs.add(0)  # a raiz dá o nome mesmo quando a lista não a inclui ("C:(3,5)")
    return HarteChord(root=root, intervals=frozenset(ivs), bass=bass)


def is_minor(ivs: frozenset[int] | set[int]) -> bool:
    """Terça menor (e não é diminuto): o "m" do nome."""
    return 3 in ivs and 4 not in ivs and not (6 in ivs and 7 not in ivs)


def chord_symbol(c: HarteChord, flats: bool = False) -> str:
    """Nome na notação do app. Exemplos: Am7, C7M, G/B, D7(9), Bm7(b5), C°7, D4, G7(4), A2, C6, Am(7M)."""
    names = FLAT if flats else SHARP
    ivs = set(c.intervals)
    if c.bass not in (0, 3, 4, 6, 7, 8):
        # nota do baixo que não é da tríade (7ª, 9ª...): a cifra não repete no nome (D/C, Am/G, C/B, C/D)
        ivs.discard(c.bass)
    third = 4 if 4 in ivs else 3 if 3 in ivs else None
    fifth = 7 if 7 in ivs else 6 if 6 in ivs and third == 3 else 8 if 8 in ivs and third == 4 else None
    seventh = 11 if 11 in ivs else 10 if 10 in ivs else None
    dim = third == 3 and fifth == 6
    if dim and seventh is None and 9 in ivs:
        seventh = 9  # 7ª diminuta (C°7)
    used = {0, c.bass}
    q = ""
    ext: list[str] = []

    if third is None:  # suspenso ou "power chord"
        if 5 in ivs:
            q, sus = "4", 5
        elif 2 in ivs:
            q, sus = "2", 2
        else:
            q, sus = ("5" if 7 in ivs and len(ivs - {0, 7, c.bass}) == 0 else ""), None
        if sus is not None:
            used.add(sus)
            if seventh is not None:  # G7(4), G7M(4)
                ext.append(q)
                q = "7" if seventh == 10 else "7M"
                used.add(seventh)
        used.add(7)
    elif dim:
        used |= {3, 6}
        if seventh == 9:
            q = "°7"
        elif seventh == 10:
            q = "m7(b5)"
        elif seventh == 11:
            q = "°(7M)"
        else:
            q = "°"
        if seventh is not None:
            used.add(seventh)
    else:
        used |= {third}
        minor = third == 3
        if fifth == 8:
            q = "+" if not minor else "m(#5)"
            used.add(8)
        else:
            q = "m" if minor else ""
            used.add(7)
        if seventh == 10:
            q += "7"
            used.add(10)
        elif seventh == 11:
            q += "(7M)" if minor else "7M"
            used.add(11)
        elif 9 in ivs:  # sexta (sem sétima)
            q += "6"
            used.add(9)

    # tensões que sobraram, na ordem da cifra: 9, 11, 13 (com alterações)
    left = ivs - used
    tens = []
    if 1 in left:
        tens.append("b9")
    if 2 in left:
        tens.append("9")
    if 3 in left and third == 4:
        tens.append("#9")
    if 5 in left and third is not None:
        tens.append("11")
    if 6 in left and fifth == 7:
        tens.append("#11")
    if 8 in left and fifth == 7:
        tens.append("b13")
    if 9 in left:
        tens.append("13" if seventh is not None else "6")
    ext += tens
    name = names[c.root] + q
    if ext:
        if name.endswith(")"):  # Bm7(b5) + 11 -> Bm7(b5,11)
            name = name[:-1] + "," + ",".join(ext) + ")"
        else:
            name += "(" + ",".join(ext) + ")"
    if c.bass:
        name += "/" + names[(c.root + c.bass) % 12]
    return name


def symbol_from_harte(label: str, flats: bool = False) -> str | None:
    c = parse_harte(label)
    return chord_symbol(c, flats) if c else None
