/**
 * Quebra automática de cifras para telas estreitas.
 *
 * Uma cifra em <pre> é formada por pares "linha de acordes" (com <b>) + "linha de letra".
 * Quando a linha passa da largura disponível, os DOIS são quebrados na mesma coluna,
 * para que cada acorde continue exatamente em cima da sílaba certa.
 */

type Char = { ch: string; wrap: string[] }; // wrap = tags de abertura que envolvem o caractere
type Line = Char[];

const MIN_BREAK_RATIO = 0.5; // não quebra antes de metade da largura (evita linhas muito curtas)
const TAB_SIZE = 8; // tab-size padrão do navegador num <pre>

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openTag(el: Element) {
  const shallow = el.cloneNode(false) as Element;
  const html = shallow.outerHTML;
  const close = `</${el.tagName.toLowerCase()}>`;
  return html.endsWith(close) ? html.slice(0, -close.length) : html;
}

/** Converte o conteúdo de um elemento em linhas de caracteres, guardando as tags que envolvem cada um. */
function toLines(root: Element): Line[] {
  const lines: Line[] = [[]];
  const walk = (node: Node, wrap: string[]) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const ch of child.textContent ?? '') {
          if (ch === '\n') lines.push([]);
          else if (ch === '\t') {
            // Tab ocupa até a próxima parada de tabulação na tela, não 1 coluna: vira espaços.
            const line = lines[lines.length - 1];
            const n = TAB_SIZE - (line.length % TAB_SIZE);
            for (let i = 0; i < n; i++) line.push({ ch: ' ', wrap });
          } else if (ch !== '\r') lines[lines.length - 1].push({ ch, wrap });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (el.tagName === 'BR') lines.push([]);
        else walk(el, [...wrap, openTag(el)]);
      }
    });
  };
  walk(root, []);
  return lines;
}

function closeTagOf(open: string) {
  const name = open.match(/^<([a-zA-Z0-9-]+)/)?.[1] ?? 'span';
  return `</${name}>`;
}

function serializeLine(line: Line): string {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const wrap = line[i].wrap;
    let text = '';
    while (i < line.length && line[i].wrap === wrap) text += line[i++].ch;
    out += wrap.join('') + escapeHtml(text) + [...wrap].reverse().map(closeTagOf).join('');
  }
  return out;
}

const isChordLine = (line: Line) => line.some((c) => c.wrap.some((t) => /^<b[\s>]/i.test(t)));
const isBlank = (line: Line) => line.every((c) => c.ch.trim() === '');
const charAt = (line: Line, i: number) => (i >= 0 && i < line.length ? line[i].ch : ' ');
const isSpace = (s: string) => s.trim() === '';

/** Uma coluna k é "segura" para quebrar se não corta um acorde no meio. */
function safeForChords(chords: Line | null, k: number) {
  if (!chords) return true;
  return isSpace(charAt(chords, k - 1)) || isSpace(charAt(chords, k));
}

/** Escolhe onde quebrar: de preferência entre palavras da letra e sem cortar acordes. */
function findBreak(chords: Line | null, text: Line | null, max: number): number {
  const min = Math.max(1, Math.floor(max * MIN_BREAK_RATIO));
  const base = text && !isBlank(text) ? text : chords;

  if (base) {
    // 1) espaço na letra (ou entre acordes, se não houver letra) sem cortar acorde
    for (let k = max; k >= min; k--) {
      if (isSpace(charAt(base, k - 1)) && !isSpace(charAt(base, k)) && safeForChords(chords, k)) return k;
      if (isSpace(charAt(base, k)) && safeForChords(chords, k)) return k;
    }
  }
  // 2) qualquer ponto que não corte acorde
  for (let k = max; k >= min; k--) if (safeForChords(chords, k)) return k;
  // 3) não tem jeito: corta na largura máxima
  return max;
}

function leadingSpaces(line: Line) {
  let n = 0;
  while (n < line.length && isSpace(line[n].ch)) n++;
  return n;
}

function trimEnd(line: Line): Line {
  let end = line.length;
  while (end > 0 && isSpace(line[end - 1].ch)) end--;
  return line.slice(0, end);
}

/** Quebra um par acorde+letra (qualquer um dos dois pode ser null). */
function wrapPair(chords: Line | null, text: Line | null, max: number): Line[] {
  const out: Line[] = [];
  let c = chords;
  let t = text;

  const width = () => Math.max(c ? trimEnd(c).length : 0, t ? trimEnd(t).length : 0);

  while (width() > max) {
    const k = findBreak(c, t, max);
    if (c) out.push(trimEnd(c.slice(0, k)));
    if (t) out.push(trimEnd(t.slice(0, k)));

    let restC = c ? c.slice(k) : null;
    let restT = t ? t.slice(k) : null;

    // Remove o recuo comum do que sobrou, mantendo o alinhamento entre acorde e letra
    const cLead = restC && !isBlank(restC) ? leadingSpaces(restC) : Infinity;
    const tLead = restT && !isBlank(restT) ? leadingSpaces(restT) : Infinity;
    const drop = Math.min(cLead, tLead);
    if (Number.isFinite(drop) && drop > 0) {
      restC = restC ? restC.slice(drop) : null;
      restT = restT ? restT.slice(drop) : null;
    }

    c = restC && !isBlank(restC) ? restC : null;
    t = restT && !isBlank(restT) ? restT : null;
  }

  // Espaços no fim da linha não aparecem, mas dentro do <pre> ocupam largura e criam rolagem lateral.
  if (c) out.push(trimEnd(c));
  if (t) out.push(trimEnd(t));
  return out;
}

function wrapLines(lines: Line[], max: number): Line[] {
  const out: Line[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (isChordLine(line) && next && !isChordLine(next) && !isBlank(next)) {
      out.push(...wrapPair(line, next, max));
      i++;
    } else if (isChordLine(line)) {
      out.push(...wrapPair(line, null, max));
    } else {
      out.push(...wrapPair(null, line, max));
    }
  }
  return out;
}

/**
 * Recebe o HTML da cifra e devolve o mesmo HTML com as linhas dos <pre> quebradas em `maxCols` colunas.
 * Se não houver <pre>, devolve o HTML original.
 */
export function wrapChordSheetHtml(html: string | undefined, maxCols: number): string | undefined {
  if (!html || typeof document === 'undefined' || !Number.isFinite(maxCols) || maxCols < 10) return html;

  const container = document.createElement('div');
  container.innerHTML = html;
  const pres = container.querySelectorAll('pre');
  if (!pres.length) return html;

  pres.forEach((pre) => {
    const lines = toLines(pre);
    pre.innerHTML = wrapLines(lines, maxCols).map(serializeLine).join('\n');
  });

  return container.innerHTML;
}
