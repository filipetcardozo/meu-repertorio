/**
 * "Seguir a voz": compara as palavras reconhecidas pelo microfone com a letra
 * e decide em que palavra/linha o cantor está.
 *
 * A letra vira uma sequência única de palavras (tokens), cada uma sabendo a que linha pertence.
 * Guardamos um cursor (posição atual na sequência). A cada resultado do reconhecimento,
 * alinhamos as últimas palavras ouvidas com a letra, mas só numa janela perto do cursor
 * (um pouco para trás, bastante para frente). Assim um refrão repetido lá embaixo
 * não puxa a tela: vale sempre a ocorrência mais próxima à frente.
 *
 * Saltos maiores pedem mais evidência (mais palavras seguidas batendo). Se o cantor pulou
 * um trecho, o "ressincronismo" procura na música inteira, mas só pula depois de dois
 * resultados finais seguidos apontando para o mesmo lugar.
 */

export type Token = { w: string; line: number; weight: number };

export type FollowState = {
  /** Índice do token onde o cantor está (-1 = antes do começo). */
  cursor: number;
  /** Candidato de salto longo aguardando confirmação. */
  pendingJump: { line: number; hits: number } | null;
};

export const initialFollowState = (): FollowState => ({ cursor: -1, pendingJump: null });

/** Quantas palavras recentes entram no alinhamento. */
export const MAX_HEARD_WORDS = 8;

const RECENCY = 0.88; // palavra mais antiga pesa menos
const MIN_SIM = 0.7;
const WINDOW_BACK = 8; // tokens
const WINDOW_FORWARD = 45; // tokens (~4 a 6 linhas)

// Palavras muito comuns valem pouco: sozinhas não podem mover o cursor.
const STOPWORDS = new Set(
  (
    'a o e de da do das dos que em um uma uns umas os as no na nos nas se me te lhe vos pra pro por com sem ' +
    'eu tu ele ela eles elas meu minha teu tua seu sua ao aos mas mais ou ja nao sim so la ca tao vai vem ' +
    'oh o ah uh eh hey yeah uou ooh uhu'
  ).split(' '),
);

// Formas que o reconhecimento costuma escrever diferente da letra.
const CANONICAL: Record<string, string> = {
  para: 'pra',
  pro: 'pra',
  ta: 'esta',
  to: 'estou',
  ce: 'voce',
  vc: 'voce',
  tava: 'estava',
};

export function normalizeWord(raw: string): string {
  const w = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return CANONICAL[w] ?? w;
}

export function tokenize(text: string): string[] {
  return text
    .split(/[\s\-–—/_.,;:!?¿¡"“”()[\]{}]+/)
    .map(normalizeWord)
    .filter(Boolean);
}

export function wordWeight(w: string): number {
  if (STOPWORDS.has(w)) return 0.35;
  if (w.length <= 2) return 0.5;
  return 1;
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Semelhança 0..1 entre duas palavras já normalizadas (tolera erros pequenos do reconhecimento). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return 0;
  const d = levenshtein(a, b, 2);
  if (d === 1) return 0.85;
  if (d === 2 && minLen >= 6) return 0.72;
  if (minLen >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.75;
  return 0;
}

export function buildTokens(lines: { tokens: string[] }[]): Token[] {
  const out: Token[] = [];
  lines.forEach((l, line) => l.tokens.forEach((w) => out.push({ w, line, weight: wordWeight(w) })));
  return out;
}

type Cell = { pos: number; score: number; count: number };

/**
 * Alinhamento local (palavras ouvidas, em ordem) x tokens[lo..hi].
 * Cada célula = melhor sequência que termina com a palavra i casando no token pos.
 * Palavras mais recentes pesam mais, e buracos (palavras/tokens pulados) custam um pouco.
 */
function align(words: string[], tokens: Token[], lo: number, hi: number): Cell[] {
  const n = words.length;
  const w = hi - lo + 1;
  if (n === 0 || w <= 0) return [];
  const M = new Float64Array(n * w).fill(-Infinity);
  const C = new Uint8Array(n * w);
  const cells: Cell[] = [];

  for (let i = 0; i < n; i++) {
    const rec = RECENCY ** (n - 1 - i);
    const ww = wordWeight(words[i]);
    for (let k = 0; k < w; k++) {
      const tok = tokens[lo + k];
      const s = similarity(words[i], tok.w);
      if (s < MIN_SIM) continue;
      const gain = s * Math.min(ww, tok.weight) * rec;
      let prev = 0;
      let prevCount = 0;
      for (let di = 1; di <= 3 && i - di >= 0; di++) {
        for (let dk = 1; dk <= 4 && k - dk >= 0; dk++) {
          const v = M[(i - di) * w + (k - dk)];
          if (v === -Infinity) continue;
          const c = v - 0.12 * (di - 1) - 0.06 * (dk - 1);
          if (c > prev) {
            prev = c;
            prevCount = C[(i - di) * w + (k - dk)];
          }
        }
      }
      const score = gain + prev;
      M[i * w + k] = score;
      C[i * w + k] = prevCount + 1;
      cells.push({ pos: lo + k, score, count: prevCount + 1 });
    }
  }
  return cells;
}

/** Evidência mínima para mudar de linha, conforme o tamanho do salto. */
function requiredScore(lineJump: number): number {
  if (lineJump < 0) return 2.0; // voltar exige bastante certeza
  if (lineJump <= 1) return 0.85; // mesma linha ou a próxima
  return 1.6 + 0.12 * (lineJump - 2);
}

export type Decision = FollowState & { score: number };

export function decide(words: string[], tokens: Token[], state: FollowState, isFinal: boolean): Decision {
  if (!tokens.length || !words.length) return { ...state, score: 0 };

  const p = Math.min(state.cursor, tokens.length - 1);
  const curLine = p >= 0 ? tokens[p].line : -1;

  // 1) Perto de onde estamos
  const lo = Math.max(0, p - WINDOW_BACK);
  const hi = Math.min(tokens.length - 1, Math.max(p, 0) + WINDOW_FORWARD);
  let best: { pos: number; adj: number; score: number } | null = null;
  let bestRaw = 0;
  for (const c of align(words, tokens, lo, hi)) {
    bestRaw = Math.max(bestRaw, c.score);
    const d = c.pos - p;
    const penalty = d >= 0 ? 0.012 * d : 0.4 + 0.06 * -d;
    if (c.score < requiredScore(tokens[c.pos].line - curLine)) continue;
    const adj = c.score - penalty;
    if (!best || adj > best.adj) best = { pos: c.pos, adj, score: c.score };
  }
  if (best) return { cursor: best.pos, pendingJump: null, score: best.score };

  // 2) Perdemos o fio: procura na música toda, mas só pula com confirmação.
  if (isFinal && bestRaw < 1.2) {
    let g: Cell | null = null;
    for (const c of align(words, tokens, 0, tokens.length - 1)) {
      if (c.count >= 3 && c.score >= 2.4 && (!g || c.score > g.score)) g = c;
    }
    if (g) {
      const line = tokens[g.pos].line;
      const pj = state.pendingJump;
      if (pj && line >= pj.line && line - pj.line <= 2) {
        if (pj.hits + 1 >= 2) return { cursor: g.pos, pendingJump: null, score: g.score };
        return { ...state, pendingJump: { line, hits: pj.hits + 1 }, score: 0 };
      }
      return { ...state, pendingJump: { line, hits: 1 }, score: 0 };
    }
  }

  return { ...state, score: 0 };
}
