/**
 * Mudança de tom da cifra: acordes, tom da música e o deslocamento (offset) em semitons.
 *
 * - Só mexe no que é acorde de verdade ("Bridge", "Intro:", "Bis" ficam como estão).
 * - Aceita pontuação em volta: "(G)", "|C", "[Am]", "A-E".
 * - Escreve com bemol ou sustenido conforme o tom de destino (F, Bb, Eb... usam bemol).
 * - Mantém os acordes em cima da sílaba certa: quando um acorde cresce ("C" -> "C#"),
 *   tira espaços depois dele; quando encolhe, completa com espaços.
 */
import { cleanChordToken, noteToPc } from './parseChord';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Tons maiores / menores escritos com bemol (pela tônica: 0 = C ... 11 = B). */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1]);     // F, Bb, Eb, Ab, Db
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]);  // Dm, Gm, Cm, Fm, Bbm, Ebm

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Offset equivalente entre -5 e +6 (+7 e -5 dão o mesmo tom). */
export function normalizeOffset(offset: number | null | undefined): number {
  const n = Number(offset);
  if (!Number.isFinite(n)) return 0;
  return mod12(Math.round(n) + 5) - 5;
}

export function prefersFlats(tonic: number, minor: boolean): boolean {
  return (minor ? FLAT_MINOR : FLAT_MAJOR).has(mod12(tonic));
}

function spell(pc: number, flats: boolean): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

const KEY_RE = /^\s*([A-Ga-g])([#b]?)(m(?!aj))?/;

function parseTone(tone: string | null | undefined) {
  const m = tone?.match(KEY_RE);
  if (!m) return null;
  const written = m[1].toUpperCase() + m[2];
  const tonic = noteToPc(written);
  if (tonic === null) return null;
  return { written, tonic, minor: !!m[3] };
}

/** Tom da música depois da mudança ("F" +5 -> "Bb"). null se o tom cadastrado não for válido. */
export function transposeKey(tone: string | null | undefined, offset: number): string | null {
  const key = parseTone(tone);
  if (!key) return null;
  const n = mod12(offset);
  const suffix = key.minor ? 'm' : '';
  if (n === 0) return key.written + suffix;
  const tonic = mod12(key.tonic + n);
  return spell(tonic, prefersFlats(tonic, key.minor)) + suffix;
}

// Sufixo de acorde: só o vocabulário de cifra (7M, m7(b5), sus4, add9, °, 6/9, 5-...).
const SUFFIX_RE = /^(?:maj|min|dim|aug|sus|add|no|omit|[0-9mM#b+\-°º()/,.])*$/;
const ROOT_RE = /^([A-G][#b]?)(.*)$/;
const BASS_RE = /\/([A-G][#b]?)$/;

/** "C7(9)/E" é acorde; "Bridge", "Intro" não. */
export function isChordSymbol(symbol: string): boolean {
  const m = symbol.match(ROOT_RE);
  if (!m) return false;
  const suffix = m[2].replace(BASS_RE, '');
  return SUFFIX_RE.test(suffix);
}

function transposeSymbol(symbol: string, n: number, flats: boolean): string {
  const m = symbol.match(ROOT_RE)!;
  const root = spell(noteToPc(m[1])! + n, flats);
  const rest = m[2].replace(BASS_RE, (_, bass: string) => '/' + spell(noteToPc(bass)! + n, flats));
  return root + rest;
}

/**
 * Transpõe um "pedaço" de cifra sem espaços: "Am7", "(G)", "D/F#", "A-E".
 * Devolve o texto igual se não for acorde.
 */
export function transposeChordToken(token: string, offset: number, flats = false): string {
  const n = mod12(offset);
  if (n === 0) return token;
  const core = cleanChordToken(token);
  if (!core) return token;
  const start = token.indexOf(core);
  if (start < 0) return token;
  const parts = core.split(/-(?=[A-G])/);
  if (!parts.every(isChordSymbol)) return token;
  return token.slice(0, start)
    + parts.map((p) => transposeSymbol(p, n, flats)).join('-')
    + token.slice(start + core.length);
}

export type ChordSheetSegment = { text: string; chord: boolean };

const TOKEN_RE = /\r?\n|[^\S\r\n]+|\S+/g;

function firstChordKey(segments: ChordSheetSegment[]) {
  for (const seg of segments) {
    if (!seg.chord) continue;
    for (const tok of seg.text.split(/\s+/)) {
      const core = cleanChordToken(tok).split(/-(?=[A-G])/)[0];
      if (core && isChordSymbol(core)) return parseTone(core);
    }
  }
  return null;
}

/**
 * Transpõe uma cifra dividida em pedaços de texto (na ordem do documento), dizendo quais
 * pedaços são acordes (<b>). Devolve o novo texto de cada pedaço.
 * O tom de destino (para escolher bemol/sustenido) vem do tom cadastrado ou, sem ele, do 1º acorde.
 */
export function transposeSegments(
  segments: ChordSheetSegment[],
  offset: number,
  originalTone?: string | null,
): string[] {
  const n = mod12(offset);
  if (n === 0) return segments.map((s) => s.text);

  const key = parseTone(originalTone) ?? firstChordKey(segments);
  const flats = key ? prefersFlats(key.tonic + n, key.minor) : false;

  // Diferença de largura ainda não compensada na linha atual (>0: sobrou caractere; <0: faltou).
  let debt = 0;
  return segments.map((seg) => seg.text.replace(TOKEN_RE, (tok) => {
    if (tok.endsWith('\n')) { debt = 0; return tok; }
    if (!tok.trim()) {
      if (debt > 0) {
        const cut = Math.min(debt, tok.length - 1); // sempre sobra 1 espaço entre acordes
        debt -= cut;
        return tok.slice(0, tok.length - cut);
      }
      if (debt < 0) {
        const pad = ' '.repeat(-debt);
        debt = 0;
        return tok + pad;
      }
      return tok;
    }
    if (!seg.chord) return tok;
    const out = transposeChordToken(tok, n, flats);
    debt += out.length - tok.length;
    return out;
  }));
}

/** Transpõe, no lugar, os acordes (<b>/<strong>) dentro de um elemento HTML. */
export function transposeChordSheetElement(root: HTMLElement, offset: number, originalTone?: string | null) {
  if (mod12(offset) === 0) return;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const segments = nodes.map((node) => ({ text: node.data, chord: !!node.parentElement?.closest('b, strong') }));
  transposeSegments(segments, offset, originalTone).forEach((text, i) => {
    if (nodes[i].data !== text) nodes[i].data = text;
  });
}
