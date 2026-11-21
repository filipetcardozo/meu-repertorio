import { matchHeader } from './simplifyChordSheet';

/**
 * Títulos de seção da cifra ("[Refrão]", "----- Refrão -----", "Refrão:") viram um rótulo próprio:
 * `<em class="section-title">Refrão<i class="repeat">2×</i></em>`, estilizado no show (centralizado,
 * com linha tracejada dos lados). Só muda a exibição: a cifra salva continua igual.
 *
 * Usa <em> (e não <span>) porque esconder as tablaturas remove todos os <span> da cifra.
 * Acordes que vêm na mesma linha do título ("[Intro] D  G") descem para a linha de baixo,
 * na mesma coluna, para continuarem alinhados com a linha seguinte.
 */

const REPEAT_MARK = /<i class="repeat">([^<]*)<\/i>/gi;
const TAB_OPEN = /<span[^>]*class="[^"]*tablatura[^"]*"[^>]*>/i;

const strip = (s: string) => s.replace(/<[^>]+>/g, '');
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "(2x) — repete" → ["2×", "repete"]; "— igual a Intro" → ["igual a Intro"] */
function markChips(marks: string[]): string[] {
  const chips: string[] = [];
  for (const m of marks) {
    const times = m.match(/\((\d+)\s*x\)/i);
    if (times) chips.push(`${times[1]}×`);
    const label = m.split(/—|–/)[1]?.trim();
    if (label) chips.push(label);
    if (!times && !label && m.trim()) chips.push(m.trim());
  }
  return chips;
}

function decorateLine(line: string): string | null {
  // Marcas do modo compacto saem do texto antes de reconhecer o título
  const marks: string[] = [];
  const clean = line.replace(REPEAT_MARK, (_, t) => {
    marks.push(t);
    return '';
  });
  const h = matchHeader(clean);
  if (!h) return null;

  // Texto do título nos formatos "[Nome] (2x)" ou "Nome:" — vezes escritas à mão também viram selo
  let name = h.name;
  let rest = '';
  const close = clean.indexOf(']');
  if (/^\s*\[/.test(strip(clean)) && close >= 0) {
    const restRaw = clean.slice(close + 1);
    const restText = strip(restRaw).trim();
    const handTimes = restText.match(/^\(?\s*(\d+)\s*x\s*\)?$/i);
    if (handTimes) marks.unshift(`(${handTimes[1]}x)`);
    else if (restText) {
      // Acordes depois do título: descem uma linha, na mesma coluna
      rest = '\n' + ' '.repeat(strip(clean.slice(0, close + 1)).length) + restRaw;
    }
  }
  name = name.replace(/\s+/g, ' ').trim();

  const chips = markChips(marks)
    .map((c) => `<i class="repeat">${escapeHtml(c)}</i>`)
    .join('');
  return `<em class="section-title">${escapeHtml(name)}${chips}</em>${rest}`;
}

export function decorateSectionTitles(html: string | undefined | null): string {
  if (!html) return html ?? '';
  try {
    let inTab = false;
    let afterTitle = false;
    return html
      .split(/\r?\n/)
      .map((line): string | null => {
        // O rótulo já separa as partes: a linha em branco logo depois dele sai
        const wasAfterTitle = afterTitle;
        afterTitle = false;
        if (wasAfterTitle && !inTab && line.trim() === '') return null;
        if (inTab) {
          if (/<\/span>/i.test(line)) inTab = false;
          return line;
        }
        const open = line.match(TAB_OPEN);
        if (open) {
          if (!/<\/span>/i.test(line.slice((open.index ?? 0) + open[0].length))) inTab = true;
          return line;
        }
        // Linha com <pre> no começo: decora só o que vem depois dele
        const pre = line.match(/^(\s*<pre[^>]*>)(.*)$/i);
        const post = !pre && line.match(/^(.*?)(<\/pre>\s*)$/i);
        const head = pre ? pre[1] : '';
        const tail = post ? post[2] : '';
        const body = pre ? pre[2] : post ? post[1] : line;
        const d = decorateLine(body);
        if (d === null) return line;
        afterTitle = !d.includes('\n'); // título com acordes na linha de baixo já tem conteúdo colado
        return head + d + tail;
      })
      .filter((l): l is string => l !== null)
      .join('\n');
  } catch {
    return html;
  }
}
