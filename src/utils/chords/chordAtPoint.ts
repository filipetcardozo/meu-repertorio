/**
 * Descobre qual acorde foi clicado dentro da cifra.
 *
 * Os acordes ficam em <b>, e um mesmo <b> pode ter vários acordes separados por espaço
 * ("C    G/B   Am"). Usa a posição do clique para achar a palavra certa.
 */
import { cleanChordToken, parseChord } from './parseChord';

export type ClickedChord = { name: string; rect: DOMRect };

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as CaretDoc;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

const isSpace = (c: string | undefined) => c === undefined || c.trim() === '';

export function chordAtPoint(target: EventTarget | null, x: number, y: number): ClickedChord | null {
  if (!(target instanceof Element)) return null;
  const b = target.closest('b, strong');
  if (!b || !b.closest('[data-lyric-body]')) return null;

  const caret = caretAt(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE || !b.contains(caret.node)) return null;

  const node = caret.node as Text;
  const s = node.data;
  let i = Math.min(caret.offset, s.length);
  // O cursor pode cair logo depois da última letra do acorde.
  if (isSpace(s[i]) && !isSpace(s[i - 1])) i--;
  if (isSpace(s[i])) return null;

  let start = i;
  let end = i;
  while (start > 0 && !isSpace(s[start - 1])) start--;
  while (end < s.length && !isSpace(s[end])) end++;

  const raw = s.slice(start, end);
  const name = cleanChordToken(raw);
  if (!parseChord(name)) return null;

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const rect = range.getBoundingClientRect();
  // Confere se o clique foi mesmo em cima da palavra (e não no espaço ao lado).
  if (x < rect.left - 4 || x > rect.right + 4) return null;

  return { name, rect };
}
