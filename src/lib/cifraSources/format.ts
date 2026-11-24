/**
 * Peças comuns para converter cifras de outros sites no formato salvo pelo app:
 * `<pre>` com acordes em `<b>` e tablaturas em `<span class="tablatura">`.
 *
 * Cada leitor transforma a página em linhas de texto onde os acordes estão marcados com
 * CHORD_OPEN/CHORD_CLOSE; daqui sai o HTML final (com escape) já com os <b>.
 */

export const CHORD_OPEN = '\u0001';
export const CHORD_CLOSE = '\u0002';
export const markChord = (name: string) => `${CHORD_OPEN}${name}${CHORD_CLOSE}`;

const MARKED = new RegExp(`${CHORD_OPEN}([^${CHORD_CLOSE}]*)${CHORD_CLOSE}`, 'g');

export function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Linha de tablatura: "e|--0--3--|", "B|-1h2---" ... */
const TAB_LINE = /^\s*[A-Ga-g][#b]?\s*\|[-\d|hpbrsx/\\~()^.*=<> ]*$/;

/** Seções em inglês (Ultimate Guitar) → nomes usados no app. */
const SECTION_NAMES: [RegExp, (n: string) => string][] = [
  [/^intro$/i, () => 'Intro'],
  [/^verse\s*(\d*)$/i, (n) => ['Primeira Parte', 'Segunda Parte', 'Terceira Parte', 'Quarta Parte'][Number(n || 1) - 1] ?? `Parte ${n}`],
  [/^pre[-\s]?chorus$/i, () => 'Pré-Refrão'],
  [/^chorus$/i, () => 'Refrão'],
  [/^bridge$/i, () => 'Ponte'],
  [/^(guitar\s+)?solo$/i, () => 'Solo'],
  [/^interlude$/i, () => 'Interlúdio'],
  [/^instrumental$/i, () => 'Instrumental'],
  [/^outro$/i, () => 'Final'],
];

export function sectionName(raw: string): string {
  const name = raw.replace(/[:\s]+$/, '').trim();
  const numbered = name.match(/^(.*?)\s*(\d+)$/);
  for (const [re, label] of SECTION_NAMES) {
    const m = name.match(re);
    if (m) return label(m[1] ?? '');
    if (numbered && re.test(numbered[1]) && /^verse/i.test(numbered[1])) return label(numbered[2]);
  }
  return name;
}

/**
 * Linhas de texto (acordes já marcados) → HTML salvo.
 * Blocos de linhas de tablatura viram um <span class="tablatura"> cada.
 */
export function linesToCifraHtml(lines: string[]): string {
  const out: string[] = [];
  let tab: string[] = [];
  const flushTab = () => {
    if (tab.length) out.push(`<span class="tablatura">${tab.join('\n')}</span>`);
    tab = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/[ \t]+$/, '');
    const html = escapeHtml(line).replace(MARKED, (_, c) => `<b>${c}</b>`);
    if (TAB_LINE.test(line.replace(MARKED, '$1'))) tab.push(html);
    else {
      flushTab();
      out.push(html);
    }
  }
  flushTab();
  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '');
  return `<pre>${body}</pre>`;
}

/** Primeiro bloco JSON-LD do tipo pedido. */
export function readJsonLd(html: string, type: string): any | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const list = Array.isArray(data) ? data : [data];
      const found = list.find((d) => d?.['@type'] === type);
      if (found) return found;
    } catch {
      /* bloco inválido: ignora */
    }
  }
  return null;
}

export const isTone = (s: unknown): s is string => typeof s === 'string' && /^[A-G][#b]?m?$/.test(s.trim());
