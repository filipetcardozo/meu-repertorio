/**
 * Conversão da cifra salva (HTML do <pre>) para texto puro e de volta, mais a conferência
 * que garante que a IA não mexeu na letra nem nos acordes.
 *
 * - A IA trabalha em texto puro: alinhar acorde com sílaba é contar colunas, e tags atrapalham.
 * - Tablaturas viram marcadores ⟦TAB 1⟧ e voltam intactas: a IA nunca as vê.
 * - Na volta, as linhas de acordes recebem <b> de novo.
 */

import { cleanChordToken, parseChord } from '../../utils/chords/parseChord';
import { matchHeader } from '../../utils/simplifyChordSheet';

const TAB_RE = /<span[^>]*class="[^"]*tablatura[^"]*"[^>]*>[\s\S]*?<\/span>/gi;
const PLACEHOLDER_RE = /⟦TAB (\d+)⟧/g;
const placeholder = (i: number) => `⟦TAB ${i + 1}⟧`;

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type CifraText = {
  text: string;
  tabs: string[];
  /** Nomes que estavam em negrito (acordes), para reconhecer de novo mesmo os que o parser não entende (ex.: N.C.). */
  chords: Set<string>;
};

/** HTML salvo → texto puro (tablaturas trocadas por marcadores). */
export function cifraHtmlToText(html: string): CifraText {
  const tabs: string[] = [];
  const chords = new Set(
    [...html.replace(TAB_RE, '').matchAll(/<(b|strong)>([^<]*)<\/\1>/gi)].map(([, , c]) => decode(c).trim()).filter(Boolean),
  );
  const body = html
    .replace(/^\s*<pre[^>]*>/i, '')
    .replace(/<\/pre>\s*$/i, '')
    .replace(TAB_RE, (m) => {
      tabs.push(m);
      return placeholder(tabs.length - 1);
    });
  const text = decode(body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n');
  return { text, tabs, chords };
}

/** Sinais que podem aparecer numa linha de acordes sem ser acorde. */
const NOISE = /^(\||\|\||-+|\/|\(|\)|x?\d+x?|\.+|%|:|\(\d+x\)|\d+x)$/i;

/** Linha que só tem acordes (e sinais como "|", "(2x)"); null se não for. */
function chordTokens(line: string, known?: Set<string>): { start: number; chord: string }[] | null {
  const tokens: { start: number; chord: string }[] = [];
  let any = false;
  for (const m of line.matchAll(/\S+/g)) {
    const token = m[0];
    const clean = cleanChordToken(token);
    if (known?.has(token)) {
      any = true;
      tokens.push({ start: m.index ?? 0, chord: token });
    } else if (clean && (parseChord(clean) || known?.has(clean))) {
      any = true;
      tokens.push({ start: (m.index ?? 0) + token.indexOf(clean), chord: clean });
    } else if (!NOISE.test(token)) {
      return null;
    }
  }
  return any ? tokens : null;
}

/** Divide a linha em título de seção ("[Intro]") e o resto, para achar acordes depois do título. */
function splitHeader(line: string): { head: string; rest: string } {
  const m = line.match(/^(\s*\[[^\]]+\])(.*)$/);
  return m && matchHeader(m[1]) ? { head: m[1], rest: m[2] } : { head: '', rest: line };
}

function markChords(line: string, known?: Set<string>): string {
  const { head, rest } = splitHeader(line);
  const tokens = chordTokens(rest, known);
  if (!tokens) return escapeHtml(line);
  let out = '';
  let pos = 0;
  for (const t of tokens) {
    out += escapeHtml(rest.slice(pos, t.start)) + `<b>${escapeHtml(t.chord)}</b>`;
    pos = t.start + t.chord.length;
  }
  return escapeHtml(head) + out + escapeHtml(rest.slice(pos));
}

/** Texto puro → HTML salvo (acordes em <b>, tablaturas de volta no lugar). */
export function cifraTextToHtml(text: string, tabs: string[], known?: Set<string>): string {
  const body = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .map((l) => markChords(l, known))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\s+$/g, '')
    .replace(PLACEHOLDER_RE, (_, n) => tabs[Number(n) - 1] ?? '');
  return `<pre>${body}</pre>`;
}

// ---------------------------------------------------------------------------
// Conferência

/** Acordes do HTML, na ordem, como chave musical (A# = Bb, Am7(11) = Am7/11). */
function chordKeys(html: string): string[] {
  const noTabs = html.replace(TAB_RE, '');
  return [...noTabs.matchAll(/<(b|strong)>([^<]*)<\/\1>/gi)].map(([, , raw]) => {
    const name = cleanChordToken(decode(raw));
    const p = parseChord(name);
    return p ? `${p.root}/${p.bass}/${[...p.required].sort((a, b) => a - b).join('.')}` : name;
  });
}

/** Palavras da letra, na ordem (sem acordes, títulos, marcadores, pontuação e maiúsculas). */
function lyricWords(text: string, known?: Set<string>): string[] {
  return text
    .split('\n')
    .filter((l) => !chordTokens(splitHeader(l).rest, known) && !matchHeader(l))
    .join(' ')
    .replace(PLACEHOLDER_RE, ' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export type CifraCheck = { ok: true } | { ok: false; reason: string };

/** Confere se a versão nova tem exatamente a mesma letra, os mesmos acordes e as mesmas tablaturas. */
export function checkImprovedCifra(original: CifraText, originalHtml: string, newText: string, newHtml: string): CifraCheck {
  const marks = [...newText.matchAll(PLACEHOLDER_RE)].map((m) => Number(m[1]));
  const expected = original.tabs.map((_, i) => i + 1);
  if (marks.join(',') !== expected.join(',')) {
    return { ok: false, reason: `As tablaturas (⟦TAB n⟧) precisam aparecer todas, uma vez cada e na ordem: ${expected.map((i) => `⟦TAB ${i}⟧`).join(', ') || 'nenhuma'}.` };
  }

  const a = lyricWords(original.text, original.chords);
  const b = lyricWords(newText, original.chords);
  const diff = a.findIndex((w, i) => w !== b[i]);
  if (diff >= 0 || a.length !== b.length) {
    const at = diff >= 0 ? diff : Math.min(a.length, b.length);
    return {
      ok: false,
      reason: `A letra mudou perto de "${a.slice(Math.max(0, at - 4), at + 4).join(' ')}" (versão nova: "${b.slice(Math.max(0, at - 4), at + 4).join(' ')}"). A letra precisa ficar idêntica, palavra por palavra.`,
    };
  }

  const ca = chordKeys(originalHtml);
  const cb = chordKeys(newHtml);
  const cd = ca.findIndex((c, i) => c !== cb[i]);
  if (cd >= 0 || ca.length !== cb.length) {
    return {
      ok: false,
      reason: `A sequência de acordes mudou (original tem ${ca.length} acordes, a nova tem ${cb.length}). Mova acordes e troque só a grafia (ex.: A# ↔ Bb); não acrescente, remova nem troque acordes.`,
    };
  }
  return { ok: true };
}
