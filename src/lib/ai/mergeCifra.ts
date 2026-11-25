/**
 * "Juntar com IA": a melhor cifra a partir de três fontes, cada uma boa numa coisa.
 *
 * - Cifra de referência (a da música, quase sempre do Cifra Club): os acordes de verdade, com a
 *   grafia completa (Bm7(11), D2, A/C#), e as tablaturas. Costuma resumir repetições.
 * - Letra completa (internet ou digitada): o texto exato, na ordem cantada.
 * - Cifra gerada pelo áudio (playback_sync/generate.py): a ordem real das partes no mp3, as
 *   repetições, trechos instrumentais e em que palavra cada acorde entra. Acordes só aproximados.
 *
 * Antes da IA, o código descobre a diferença de tom entre o áudio e a referência e passa os acordes
 * do áudio para o tom da referência. Depois, confere: a letra igual à informada e só acordes que
 * existem na referência ou no áudio. Se falhar, a IA tenta de novo sabendo o motivo.
 */
import { AiError, generateJson, type AiProvider } from './provider';
import { chordKeys, cifraHtmlToText, cifraTextToHtml, lyricWords } from './cifraText';
import { MAX_CIFRA_CHARS } from './improveCifra';
import { parseChord } from '../../utils/chords/parseChord';
import { transposeKey, transposeSegments, type ChordSheetSegment } from '../../utils/chords/transpose';

export type MergeCifraInput = {
  /** HTML da cifra de referência (a da música ou a importada). */
  reference: string;
  referenceTone?: string;
  /** HTML da cifra gerada pelo áudio. */
  audio: string;
  audioTone?: string;
  /** Letra completa (estrofes separadas por linha em branco); opcional. */
  lyrics?: string;
  lyricName?: string;
  composerName?: string;
};

export type MergeCifraResult = {
  lyric: string;
  tone: string;
  notes: string[];
  /** Semitons do áudio em relação à referência (o playback toca nesse tom). */
  audioShift: number;
  provider: AiProvider;
  model: string;
};

const SCHEMA = {
  type: 'object',
  properties: {
    tom: { type: 'string', description: 'Tom da cifra final (o da referência), ex.: "G", "Em".' },
    observacoes: {
      type: 'array',
      description: 'Pontos para o músico conferir, curtos, em português do Brasil (ex.: "Ponte: no áudio soa Em, a referência diz C"). Vazio se nada.',
      items: { type: 'string' },
    },
    cifra: { type: 'string', description: 'A cifra completa final, em texto puro.' },
  },
  required: ['tom', 'observacoes', 'cifra'],
  additionalProperties: false,
};

const SYSTEM = `Você monta cifras (letra com acordes) para músicos que tocam ao vivo acompanhando a gravação. Recebe três fontes da mesma música e junta o melhor de cada uma numa cifra só, em texto puro e fonte monoespaçada: cada linha de acordes fica logo acima da linha da letra, e a coluna de cada acorde indica a sílaba em que ele entra.

As fontes:
<referencia>: cifra escrita por músicos (ex.: Cifra Club). Tem os acordes CERTOS e a grafia completa deles (Bm7(11), D2, A/C#), os títulos das partes e tablaturas (marcadores ⟦TAB n⟧). Costuma resumir: escreve o refrão uma vez, pula repetições, às vezes omite partes.
<letra>: a letra completa, exatamente como é cantada na gravação, na ordem, com todas as repetições. Estrofes separadas por linha em branco.
<audio>: cifra gerada por computador ouvindo a gravação, já no tom da referência. Mostra a ORDEM REAL das partes, quantas vezes cada uma se repete, os trechos instrumentais (introdução, solos, final) e em que palavra os acordes trocam. Os acordes dela são aproximados (tríades, às vezes errados) e a letra dela pode ter erros: use só como guia de estrutura e de tempo.

Como montar:
1. Letra: use a de <letra> palavra por palavra, na mesma ordem, sem resumir nem pular repetições, sem corrigir nem traduzir. Pode quebrar ou juntar linhas para ficar parecido com a referência, mas sem mudar palavras. Se não houver <letra>, use a letra da referência repetindo as partes na ordem em que o <audio> mostra que são cantadas.
2. Acordes: para cada trecho cantado, use os acordes da parte correspondente da <referencia> (mesma letra ou mesma parte da música), com a grafia dela, na posição da sílaba como a referência faz. Quando a referência resume ("refrão 2x", parte repetida não escrita), escreva os acordes de novo em cada repetição.
3. Onde a referência não tem a parte (introdução, solo, final, variação que ela não escreveu), use os acordes do <audio>, mas trocando pela grafia da referência quando for o mesmo acorde (se o áudio diz "Bm" e a referência usa "Bm7(11)" nesse papel, escreva "Bm7(11)").
4. Se o áudio e a referência discordam de forma clara num trecho, mantenha a referência e registre em "observacoes".
5. Partes: títulos em linhas próprias, no formato [Intro], [Primeira Parte], [Segunda Parte], [Pré-Refrão], [Refrão], [Ponte], [Solo], [Final]. Acordes de trecho instrumental podem ir na mesma linha do título, depois dele. Linhas só de acordes podem usar "(2x)".
6. Tablaturas: cada ⟦TAB n⟧ pode aparecer no máximo uma vez, em linha própria, na ordem crescente, no lugar da parte a que pertence. Pode deixar de fora as que não couberem.
7. No máximo uma linha em branco entre blocos.

Regras que não podem ser quebradas:
- Só use acordes que aparecem na <referencia> ou no <audio> (pode trocar a grafia de um acorde por outra equivalente, ex.: A# por Bb).
- A cifra fica no tom da referência.
- Devolva a cifra inteira.`;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pedaços de texto do HTML, marcando os que eram acordes (<b>). */
function segmentsOf(html: string): ChordSheetSegment[] {
  const body = html.replace(/^\s*<pre[^>]*>/i, '').replace(/<\/pre>\s*$/i, '');
  const out: ChordSheetSegment[] = [];
  for (const part of body.split(/(<b(?:\s[^>]*)?>[^<]*<\/b>)/i)) {
    if (!part) continue;
    const m = part.match(/^<b(?:\s[^>]*)?>([^<]*)<\/b>$/i);
    out.push(m ? { text: m[1], chord: true } : { text: part, chord: false });
  }
  return out;
}

const chordList = (html: string) =>
  [...html.matchAll(/<b(?:\s[^>]*)?>([^<]*)<\/b>/gi)].map(([, c]) => parseChord(c)).filter((c): c is NonNullable<typeof c> => !!c);
const isMinor = (c: { required: number[] }) => c.required.includes(3) && !c.required.includes(4);

/** Semitons que o áudio está acima da referência (pelos acordes em comum). */
export function audioShift(reference: string, audio: string): number {
  const ref = chordList(reference);
  const aud = chordList(audio);
  if (!ref.length || !aud.length) return 0;
  const refSet = new Set(ref.map((c) => `${c.root}:${isMinor(c)}`));
  let best = 0;
  let bestScore = -1;
  for (let s = 0; s < 12; s++) {
    const score = aud.reduce((n, c) => n + (refSet.has(`${mod12(c.root - s)}:${isMinor(c)}`) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best > 6 ? best - 12 : best;
}

/** Cifra do áudio passada para o tom da referência. */
function audioInReferenceKey(audio: string, shift: number, audioTone?: string): string {
  if (!shift) return audio;
  const segs = segmentsOf(audio);
  const texts = transposeSegments(segs, -shift, audioTone);
  return `<pre>${segs.map((s, i) => (s.chord ? `<b>${texts[i]}</b>` : texts[i])).join('')}</pre>`;
}

/**
 * Compara a letra informada (a) com a da cifra nova (b): fração de palavras em comum na ordem (LCS) e
 * os trechos da letra informada que faltaram (para a IA corrigir na segunda tentativa).
 */
function lyricDiff(a: string[], b: string[]): { score: number; missing: string[]; extra: string[] } {
  if (!a.length) return { score: 1, missing: [], extra: [] };
  const n = a.length;
  const m = b.length;
  const L: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const missIdx: number[] = [];
  const extraIdx: number[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { missIdx.push(i++); } else { extraIdx.push(j++); }
  }
  while (i < n) missIdx.push(i++);
  while (j < m) extraIdx.push(j++);
  // agrupa índices seguidos em trechos, com 3 palavras de contexto antes
  const runs = (idx: number[], words: string[]) => {
    const out: string[] = [];
    let k = 0;
    while (k < idx.length && out.length < 4) {
      let e = k;
      while (e + 1 < idx.length && idx[e + 1] === idx[e] + 1) e++;
      const ctx = words.slice(Math.max(0, idx[k] - 3), idx[k]).join(' ');
      out.push(`${ctx ? `…${ctx} ` : ''}[${words.slice(idx[k], idx[e] + 1).slice(0, 12).join(' ')}]`);
      k = e + 1;
    }
    return out;
  };
  return { score: L[0][0] / Math.max(n, m), missing: runs(missIdx, a), extra: runs(extraIdx, b) };
}

type Check = { ok: true; soft?: string } | { ok: false; reason: string; nearLyrics?: string };

function check(text: string, html: string, tabs: string[], allowed: Set<string>, lyricsWords: string[] | null, known: Set<string>): Check {
  const marks = [...text.matchAll(/⟦TAB (\d+)⟧/g)].map((m) => Number(m[1]));
  if (marks.some((n, i) => n < 1 || n > tabs.length || (i > 0 && n <= marks[i - 1]))) {
    return { ok: false, reason: 'Cada ⟦TAB n⟧ pode aparecer no máximo uma vez, em ordem crescente, só os que existem na referência.' };
  }
  const bad = [...new Set(chordKeys(html).filter((k) => !allowed.has(k)))];
  if (bad.length) {
    const names = [...html.matchAll(/<b(?:\s[^>]*)?>([^<]*)<\/b>/gi)].map(([, c]) => c)
      .filter((c) => { const k = chordKeys(`<b>${c}</b>`)[0]; return k && !allowed.has(k); });
    return { ok: false, reason: `Apareceram acordes que não estão na referência nem no áudio: ${[...new Set(names)].slice(0, 8).join(', ')}.` };
  }
  if (lyricsWords) {
    const got = lyricWords(text, known);
    const { score, missing, extra } = lyricDiff(lyricsWords, got);
    if (score < 0.97) {
      const miss = missing.length ? ` Faltaram (entre colchetes): ${missing.join('; ')}.` : '';
      const ext = extra.length ? ` Sobraram: ${extra.join('; ')}.` : '';
      return {
        ok: false,
        reason: `A letra não está igual à de <letra> (${Math.round(score * 100)}% das palavras batem).${miss}${ext} Copie a letra palavra por palavra, na ordem, com todas as repetições.`,
        // quase certa: sem tempo para outra tentativa, vale entregar avisando o que conferir
        nearLyrics: score >= 0.9
          ? `A letra não ficou idêntica à informada (${Math.round(score * 100)}%).${missing.length ? ` Confira: ${missing.join('; ')}.` : ''}`
          : undefined,
      };
    }
    if (score < 1) return { ok: true, soft: 'A letra ficou quase igual à informada: confira se faltou alguma palavra.' };
  }
  return { ok: true };
}

function userMessage(input: MergeCifraInput, refText: string, audioText: string, retry?: string) {
  const meta = [
    input.lyricName && `Música: ${input.lyricName}`,
    input.composerName && `Artista: ${input.composerName}`,
    input.referenceTone && `Tom da referência: ${input.referenceTone}`,
  ].filter(Boolean).join('\n');
  const again = retry
    ? `\n\nAtenção: a tentativa anterior foi descartada pela conferência automática: ${retry} Refaça respeitando as regras.`
    : '';
  const lyrics = input.lyrics?.trim() ? `\n\n<letra>\n${input.lyrics.trim()}\n</letra>` : '\n\n(sem <letra>: use a da referência, repetindo as partes na ordem do áudio)';
  return `${meta}${again}\n\n<referencia>\n${refText}\n</referencia>${lyrics}\n\n<audio>\n${audioText}\n</audio>`;
}

type Raw = { tom: string; observacoes: string[]; cifra: string };

const RETRY_BUDGET_MS = Number(process.env.AI_MERGE_RETRY_BUDGET_MS) || 22000;

export async function mergeCifra(input: MergeCifraInput): Promise<MergeCifraResult> {
  const ref = cifraHtmlToText(input.reference);
  if (!ref.text.trim()) throw new AiError('A música não tem cifra para juntar.', 400);
  if (ref.text.length > MAX_CIFRA_CHARS) throw new AiError('A cifra é longa demais para a IA.', 413);

  const shift = audioShift(input.reference, input.audio);
  const audioHtml = audioInReferenceKey(input.audio, shift, input.audioTone);
  const audioText = cifraHtmlToText(audioHtml).text;

  // acordes permitidos: os da referência e os do áudio (já no tom da referência)
  const allowed = new Set([...chordKeys(input.reference), ...chordKeys(audioHtml)]);
  const known = new Set([...ref.chords, ...cifraHtmlToText(audioHtml).chords]);
  const lyricsWords = input.lyrics?.trim() ? lyricWords(input.lyrics, new Set()) : null;

  // A rota tem 60 s (Vercel Hobby) e uma tentativa leva ~30-40 s: só tenta de novo se der tempo.
  const started = Date.now();
  let reason: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, provider, model } = await generateJson<Raw>({
      system: SYSTEM,
      user: userMessage(input, ref.text, audioText, reason),
      schema: SCHEMA,
      schemaName: 'cifra_juntada',
    });
    const text = (data.cifra ?? '').replace(/^\n+|\s+$/g, '');
    const html = cifraTextToHtml(text, ref.tabs, known);
    const res = check(text, html, ref.tabs, allowed, lyricsWords, known);
    const lastChance = attempt === 1 || Date.now() - started > RETRY_BUDGET_MS;
    if (res.ok || (lastChance && res.nearLyrics)) {
      const notes = (data.observacoes ?? []).map((s) => s.trim()).filter(Boolean);
      if (res.ok && res.soft) notes.push(res.soft);
      if (!res.ok && res.nearLyrics) notes.unshift(res.nearLyrics);
      if (shift) {
        const t = transposeKey(input.referenceTone, shift);
        notes.push(`O mp3 está ${Math.abs(shift)} semitom${Math.abs(shift) > 1 ? 's' : ''} ${shift > 0 ? 'acima' : 'abaixo'} da cifra${t ? ` (em ${t})` : ''}: ajuste o tom no show para tocar junto.`);
      }
      return {
        lyric: html,
        tone: input.referenceTone || (/^[A-G][#b]?m?$/.test(data.tom?.trim() ?? '') ? data.tom.trim() : ''),
        notes,
        audioShift: shift,
        provider,
        model,
      };
    }
    reason = res.reason;
    console.warn('mergeCifra: tentativa descartada:', reason);
    if (lastChance) break;
  }
  throw new AiError('A IA não conseguiu juntar as cifras respeitando a letra e os acordes. Tente de novo.', 422);
}
