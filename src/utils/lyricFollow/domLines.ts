/**
 * Lê as linhas de letra que estão na tela (sem mexer no HTML da cifra).
 *
 * Procura os blocos marcados com `data-lyric-body`, separa as linhas de texto,
 * descarta linhas de acorde (<b>), títulos de seção ("Refrão:", "[Intro]") e tablaturas,
 * e guarda os nós de texto de cada linha para medir a posição dela depois.
 */
import { tokenize } from './aligner';

type Segment = { node: Text; start: number; end: number };

export type LyricLine = {
  text: string;
  tokens: string[];
  segments: Segment[];
  /** Linha de acordes logo acima (entra no destaque). */
  chordSegments: Segment[] | null;
  container: HTMLElement;
};

type RawLine = { segments: Segment[]; plain: string; boldChars: number; plainChars: number };

const BLOCK_TAGS = new Set(['P', 'DIV', 'PRE', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'TR', 'BLOCKQUOTE']);
const CHORD_RE = /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add|M|°|º|\+)?[0-9]*(\([^)]*\))?(\/[A-G0-9](#|b)?)?$/;
const SECTION_RE = /^(intro|introdu[cç][aã]o|refr[aã]o|pr[eé]-?refr[aã]o|ponte|solo|final|verso|parte|tab|riff|interl[uú]dio|coro|bridge|chorus|verse|outro|tom)\b/i;

function readRawLines(container: HTMLElement): RawLine[] {
  const lines: RawLine[] = [];
  let cur: RawLine = { segments: [], plain: '', boldChars: 0, plainChars: 0 };
  const breakLine = () => {
    lines.push(cur);
    cur = { segments: [], plain: '', boldChars: 0, plainChars: 0 };
  };

  const walk = (node: Node, bold: boolean) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child as Text;
        const s = t.data;
        let segStart = -1;
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (ch === '\n') {
            if (segStart >= 0) cur.segments.push({ node: t, start: segStart, end: i });
            segStart = -1;
            breakLine();
            continue;
          }
          if (ch === '\r') continue;
          if (segStart < 0) segStart = i;
          const space = ch.trim() === '';
          if (bold) {
            cur.plain += ' ';
            if (!space) cur.boldChars++;
          } else {
            cur.plain += ch;
            if (!space) cur.plainChars++;
          }
        }
        if (segStart >= 0) cur.segments.push({ node: t, start: segStart, end: s.length });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === 'BR') return breakLine();
        // Título de seção ([Refrão]…) não é cantado
        if (el.classList?.contains('section-title')) return;
        const block = BLOCK_TAGS.has(el.tagName);
        if (block && cur.segments.length) breakLine();
        walk(el, bold || el.tagName === 'B' || el.tagName === 'STRONG');
        if (block && cur.segments.length) breakLine();
      }
    });
  };

  walk(container, false);
  if (cur.segments.length) breakLine();
  return lines;
}

function isChordLine(l: RawLine): boolean {
  if (l.boldChars > 0 && l.plainChars === 0) return true;
  const parts = l.plain.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => CHORD_RE.test(p) || /^[|/\-–x0-9()]+$/i.test(p));
}

function cleanLyric(plain: string): string | null {
  const t = plain.replace(/\(\s*\d+\s*x\s*\)|\bx\s*\d+\b|\b\d+\s*x\b/gi, ' ').trim();
  if (!t) return null;
  if (/^[[(].*[\])]:?$/.test(t)) return null; // [Refrão], (Solo)
  if (t.length < 40 && SECTION_RE.test(t) && (t.endsWith(':') || t.split(/\s+/).length <= 3)) return null;
  if (/[-=]{4,}|\|.*\|/.test(t)) return null; // tablatura
  return t;
}

export function extractLyricLines(root: HTMLElement): LyricLine[] {
  const out: LyricLine[] = [];
  root.querySelectorAll<HTMLElement>('[data-lyric-body]').forEach((container) => {
    const raw = readRawLines(container);
    raw.forEach((l, i) => {
      if (!l.segments.length || isChordLine(l)) return;
      const text = cleanLyric(l.plain);
      if (!text) return;
      const tokens = tokenize(text);
      if (!tokens.length) return;
      const prev = raw[i - 1];
      out.push({
        text,
        tokens,
        segments: l.segments,
        chordSegments: prev && prev.segments.length && isChordLine(prev) ? prev.segments : null,
        container,
      });
    });
  });
  return out;
}

function segmentsRect(segs: Segment[]): DOMRect | null {
  const first = segs[0];
  const last = segs[segs.length - 1];
  if (!first?.node.isConnected || !last?.node.isConnected) return null;
  const range = document.createRange();
  range.setStart(first.node, first.start);
  range.setEnd(last.node, last.end);
  const r = range.getBoundingClientRect();
  return r.height > 0 ? r : null;
}

/** Retângulo da linha na tela (incluindo a linha de acordes acima). null se o DOM mudou. */
export function lineRect(line: LyricLine): { top: number; bottom: number } | null {
  const r = segmentsRect(line.segments);
  if (!r) return null;
  const c = line.chordSegments ? segmentsRect(line.chordSegments) : null;
  return { top: c ? Math.min(c.top, r.top) : r.top, bottom: r.bottom };
}
