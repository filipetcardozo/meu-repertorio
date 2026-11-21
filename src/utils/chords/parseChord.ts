/**
 * Lê o nome de um acorde (notação brasileira e internacional) e devolve as notas que o formam.
 *
 * Exemplos aceitos: C, Am, F#m7, Bb7M, C7M(9), G7(4), E7(b9), F#m7(5-), Bm7(b5), C°, Cº7,
 * D4, Dsus4, A2, C9 (= add9), C7(9), C6(9), C6/9, C5, C5+, Cm(7M), G/B, D/F#.
 *
 * Os intervalos são em semitons a partir da raiz (0 = raiz, 4 = terça maior, 7 = quinta justa...).
 */

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type ParsedChord = {
  /** Nome como foi recebido (já limpo). */
  name: string;
  /** Classe da raiz (0 = C ... 11 = B). */
  root: number;
  /** Classe do baixo (igual à raiz quando não há baixo invertido). */
  bass: number;
  /** true quando o acorde tem baixo invertido (ex.: G/B). */
  hasSlashBass: boolean;
  /** Intervalos obrigatórios (semitons a partir da raiz, 0..11). */
  required: number[];
  /** Intervalos que podem ficar de fora se não couberem (quinta justa). */
  optional: number[];
};

export function noteToPc(note: string): number | null {
  const base = NOTE_INDEX[note[0]];
  if (base === undefined) return null;
  let pc = base;
  for (const acc of note.slice(1)) {
    if (acc === '#') pc++;
    else if (acc === 'b') pc--;
    else return null;
  }
  return ((pc % 12) + 12) % 12;
}

/** Tira pontuação em volta do acorde, como "(G)", "|C", "Am," ... */
export function cleanChordToken(token: string): string {
  let t = token.trim().replace(/^[[(|{]+/, '').replace(/[\]|},.;:]+$/, '');
  const open = (t.match(/\(/g) ?? []).length;
  let close = (t.match(/\)/g) ?? []).length;
  while (close > open && t.endsWith(')')) { t = t.slice(0, -1); close--; }
  return t;
}

type Quality = {
  third: number | null;   // 3, 4 ou null (sus / power chord)
  fifth: number | null;   // 6, 7, 8 ou null
  seventh: number | null; // 9 (dim7), 10, 11
  extra: Set<number>;
  fifthAltered: boolean;
  sus: boolean;
};

export function parseChord(raw: string): ParsedChord | null {
  const name = cleanChordToken(raw);
  const head = name.match(/^([A-G])([#b]?)(.*)$/);
  if (!head) return null;

  const root = noteToPc(head[1] + head[2]);
  if (root === null) return null;
  let rest = head[3];

  // Baixo invertido: "/" seguido de nota no final (G/B, D/F#, C7(9)/E)
  let bass = root;
  let hasSlashBass = false;
  const slash = rest.match(/\/([A-G][#b]?)$/);
  if (slash) {
    const pc = noteToPc(slash[1]);
    if (pc === null) return null;
    bass = pc;
    hasSlashBass = true;
    rest = rest.slice(0, -slash[0].length);
  }

  const q: Quality = { third: 4, fifth: 7, seventh: null, extra: new Set(), fifthAltered: false, sus: false };
  if (!parseSuffix(rest, q)) return null;

  const required = new Set<number>([0]);
  const optional = new Set<number>();
  if (q.third !== null) required.add(q.third);
  if (q.seventh !== null) required.add(q.seventh);
  q.extra.forEach((i) => required.add(i));
  if (q.fifth !== null) {
    // Quinta justa pode ser omitida; quinta alterada faz parte do som do acorde.
    if (q.fifthAltered || q.third === null) required.add(q.fifth);
    else optional.add(q.fifth);
  }
  optional.forEach((i) => required.delete(i));

  return {
    name,
    root,
    bass,
    hasSlashBass,
    required: [...required].sort((a, b) => a - b),
    optional: [...optional].filter((i) => !required.has(i)),
  };
}

/** Interpreta o sufixo (tudo depois da raiz). Devolve false se não for um acorde válido. */
function parseSuffix(input: string, q: Quality): boolean {
  let s = input.replace(/\s+/g, '');
  let isMinor = false;
  let addMode = false;
  let first = true;

  const setSeventh = (v: number) => { q.seventh = v; };

  while (s.length) {
    let m: RegExpMatchArray | null;

    // separadores
    if ((m = s.match(/^[(),/.]/))) { s = s.slice(1); addMode = false; first = false; continue; }

    // sétima maior: 7M, maj7, M7, 7+, Δ
    if ((m = s.match(/^(7M|maj7|Maj7|M7|7\+|Δ7?|maj|Maj)/))) {
      setSeventh(11);
      s = s.slice(m[0].length); first = false; continue;
    }

    // meio-diminuto
    if ((m = s.match(/^ø7?/))) {
      q.third = 3; q.fifth = 6; q.fifthAltered = true; setSeventh(10);
      isMinor = true;
      s = s.slice(m[0].length); first = false; continue;
    }

    // diminuto (com ou sem 7)
    if ((m = s.match(/^(dim|°|º|o)(7)?/))) {
      q.third = 3; q.fifth = 6; q.fifthAltered = true;
      isMinor = true;
      if (m[2]) setSeventh(9);
      s = s.slice(m[0].length); first = false; continue;
    }

    // aumentado
    if ((m = s.match(/^(aug|\+)/))) {
      q.fifth = 8; q.fifthAltered = true;
      s = s.slice(m[0].length); first = false; continue;
    }

    // menor (só logo depois da raiz)
    if (first && (m = s.match(/^(min|mi|m|-)(?!aj)/))) {
      q.third = 3; isMinor = true;
      s = s.slice(m[0].length); first = false; continue;
    }

    // sus / add
    if ((m = s.match(/^sus([24])?/))) {
      q.sus = true;
      q.third = null;
      q.extra.add(m[1] === '2' ? 2 : 5);
      s = s.slice(m[0].length); first = false; continue;
    }
    if ((m = s.match(/^add/))) { addMode = true; s = s.slice(3); first = false; continue; }

    // graus: 9, b9, #11, 5-, 9+, 13 ...
    if ((m = s.match(/^([b#])?(\d{1,2})([+-])?/))) {
      const pre = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
      const post = m[3] === '-' ? -1 : m[3] === '+' ? 1 : 0;
      const alt = pre || post;
      if (!applyDegree(Number(m[2]), alt, q, { isMinor, addMode })) return false;
      s = s.slice(m[0].length); first = false; continue;
    }

    return false;
  }
  return true;
}

function applyDegree(deg: number, alt: number, q: Quality, ctx: { isMinor: boolean; addMode: boolean }): boolean {
  switch (deg) {
    case 2:
      // "A2": segunda no lugar da terça (sus2). "add2" mantém a terça.
      if (!ctx.addMode) { q.third = null; q.sus = true; }
      q.extra.add(2 + alt);
      return true;
    case 4:
      // "D4", "G7(4)": suspenso. Em menor ("Am7(4)") a terça continua.
      if (!ctx.addMode && !ctx.isMinor) { q.third = null; q.sus = true; }
      q.extra.add(5 + alt);
      return true;
    case 5:
      if (alt) { q.fifth = 7 + alt; q.fifthAltered = true; }
      else if (q.seventh === null && q.extra.size === 0 && !ctx.isMinor) {
        // "C5": power chord (raiz + quinta)
        q.third = null; q.fifth = 7;
      }
      return true;
    case 6:
      q.extra.add(9 + alt);
      return true;
    case 7:
      if (alt > 0) setMaj7(q);
      else q.seventh = q.seventh ?? 10;
      return true;
    case 9:
      // No Brasil "C9" é acorde com nona adicionada (sem sétima).
      q.extra.add((14 + alt) % 12);
      return true;
    case 11:
      q.extra.add((17 + alt) % 12);
      return true;
    case 13:
      q.extra.add((21 + alt) % 12);
      return true;
    default:
      return false;
  }
}

function setMaj7(q: Quality) { q.seventh = 11; }
