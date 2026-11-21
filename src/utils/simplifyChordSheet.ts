/**
 * "Modo compacto" da cifra: resume repetições sem mexer nas linhas que ficam.
 *
 * 1. Blocos iguais em sequência viram um só com "(2x)".
 * 2. Uma seção igual a uma anterior vira só o título com "— repete" (ou "— igual a Intro").
 *
 * Para comparar, usa as palavras da letra + a sequência de acordes: diferenças de quebra de linha,
 * espaços e pontuação não contam ("fazer / Com essa" = "fazer com / Essa"). Letra diferente nunca é resumida.
 * As linhas mantidas são copiadas como estão, então os acordes continuam alinhados com as sílabas.
 */

type Section = {
  /** Linha do título (ex.: "[Refrão]", "----- Refrão -----"); null antes do primeiro título */
  header: string | null;
  name: string;
  /** Resto da primeira linha depois do título (ex.: acordes em "[Intro] E  A") */
  headerRest: string;
  /** Linhas que vêm junto com o título no mesmo bloco */
  headerBlock: string[];
  blocks: string[][];
};

const TAB_OPEN = /<span[^>]*class="[^"]*tablatura[^"]*"[^>]*>/i;

const strip = (s: string) => s.replace(/<[^>]+>/g, '');
const normalize = (s: string) =>
  strip(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9#/()|\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CHORD_TAG = /<(b|strong)>([^<]*)<\/\1>/gi;
const isChordLine = (l: string) =>
  /<(b|strong)>/i.test(l) && strip(l.replace(CHORD_TAG, '')).replace(/[\s()|x\d.]/gi, '') === '';
const isTabLabel = (l: string) => /^\s*\[tab\b/i.test(strip(l));

/** Título de seção: "[Refrão]", "----- Refrão -----" ou "Refrão:" sozinho na linha. */
export function matchHeader(line: string): { name: string; rest: string } | null {
  const text = strip(line);
  let m = text.match(/^\s*\[([^\]]+)\](.*)$/);
  if (m && !/^tab\b/i.test(m[1].trim())) return { name: m[1].trim(), rest: m[2] };
  m = text.match(/^\s*-{2,}\s*([^-].*?)\s*-{2,}\s*$/);
  if (m) return { name: m[1].trim(), rest: '' };
  m = text.match(/^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ºª-]{1,28}):\s*$/);
  if (m) return { name: m[1].trim(), rest: '' };
  return null;
}

/** Chave de comparação de um trecho: palavras da letra + acordes. */
function keyOf(lines: string[]): string {
  const content = lines.filter((l) => !isTabLabel(l));
  const chords = content.flatMap((l) => [...l.matchAll(CHORD_TAG)].map((m) => m[2].trim())).join(' ');
  const words = normalize(content.filter((l) => !isChordLine(l)).map((l) => l.replace(CHORD_TAG, ' ')).join(' '));
  return `${words}|${chords}`;
}

/** Quebra em blocos (separados por linha em branco); uma tablatura inteira é um bloco só. */
function toBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  let inTab = false;
  const flush = () => {
    if (cur.length) blocks.push(cur);
    cur = [];
  };
  for (const line of lines) {
    if (inTab) {
      cur.push(line);
      if (/<\/span>/i.test(line)) {
        inTab = false;
        flush();
      }
      continue;
    }
    const open = line.match(TAB_OPEN);
    if (open) {
      flush();
      cur.push(line);
      const afterOpen = line.slice((open.index ?? 0) + open[0].length);
      if (/<\/span>/i.test(afterOpen)) flush();
      else inTab = true;
      continue;
    }
    if (strip(line).trim() === '') flush();
    else cur.push(line);
  }
  flush();
  return blocks;
}

function toSections(blocks: string[][]): Section[] {
  const sections: Section[] = [];
  for (const b of blocks) {
    const h = matchHeader(b[0]);
    if (h) {
      sections.push({ header: b[0], name: h.name, headerRest: h.rest, headerBlock: b.slice(1), blocks: [] });
    } else if (!sections.length) {
      sections.push({ header: null, name: '', headerRest: '', headerBlock: [], blocks: [b] });
    } else {
      sections[sections.length - 1].blocks.push(b);
    }
  }
  return sections;
}

const mark = (text: string) => ` <i class="repeat">${text}</i>`;

export type SimplifyResult = {
  html: string;
  /** false quando não havia o que resumir */
  changed: boolean;
};

export function simplifyChordSheet(html: string | undefined | null): SimplifyResult {
  if (!html) return { html: html ?? '', changed: false };
  try {
    // Mantém o <pre> (e o que houver fora dele) como está
    const open = html.match(/<pre[^>]*>/i);
    const closeAt = html.toLowerCase().lastIndexOf('</pre>');
    const start = open ? (open.index ?? 0) + open[0].length : 0;
    const end = open && closeAt > start ? closeAt : html.length;
    const before = html.slice(0, start);
    const inner = html.slice(start, end);
    const after = html.slice(end);

    const sections = toSections(toBlocks(inner.split(/\r?\n/)));
    const seen: { name: string; key: string }[] = [];
    const out: string[] = [];
    let changed = false;

    for (const s of sections) {
      // 1) blocos iguais em sequência
      const collapsed: { lines: string[]; times: number }[] = [];
      for (const b of s.blocks) {
        const prev = collapsed[collapsed.length - 1];
        if (prev && keyOf(prev.lines) === keyOf(b)) {
          prev.times++;
          changed = true;
        } else collapsed.push({ lines: b, times: 1 });
      }
      const wholeTimes = collapsed.length === 1 && collapsed[0].times > 1 ? collapsed[0].times : 0;

      // 2) seção igual a uma anterior
      const body = [s.headerRest, ...s.headerBlock, ...collapsed.flatMap((c) => c.lines)];
      const key = keyOf(body);
      const meaningful = key.replace(/[|\s]/g, '').length >= 8;
      const same = s.header && meaningful ? seen.find((x) => x.key === key) : undefined;

      if (s.header && same) {
        changed = true;
        const label = same.name.toLowerCase() === s.name.toLowerCase() ? 'repete' : `igual a ${same.name}`;
        // Só o título: "[Solo] E A" → "[Solo]" (os acordes já estão na seção original)
        const close = s.header.indexOf(']');
        const title = s.headerRest.trim() && close >= 0 ? s.header.slice(0, close + 1) : s.header.replace(/\s+$/, '');
        out.push(title + mark(`${wholeTimes ? `(${wholeTimes}x) ` : ''}— ${label}`), '');
        continue;
      }
      if (s.header && meaningful) seen.push({ name: s.name, key });

      if (s.header) {
        out.push(wholeTimes ? s.header.replace(/\s+$/, '') + mark(`(${wholeTimes}x)`) : s.header, ...s.headerBlock, '');
      }
      for (const c of collapsed) {
        const lines = [...c.lines];
        if (c.times > 1 && !wholeTimes) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+$/, '') + mark(`(${c.times}x)`);
        // Tablatura termina numa linha só com "</span>", que já aparece vazia: não soma outra
        const endsEmpty = strip(lines[lines.length - 1]).trim() === '';
        out.push(...lines, ...(endsEmpty ? [] : ['']));
      }
    }

    if (!changed) return { html, changed: false };
    const body = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '');
    return { html: before + body + after, changed: true };
  } catch {
    return { html, changed: false };
  }
}
