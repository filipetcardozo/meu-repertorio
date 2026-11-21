/**
 * Gera digitações de um acorde para qualquer instrumento de trastes.
 *
 * Testa as combinações de casas que formam as notas do acorde, descarta as impossíveis
 * (dedos demais, abertura grande demais, notas faltando) e ordena das mais fáceis/comuns
 * para as mais difíceis.
 */
import type { FrettedInstrument } from './instruments';
import type { ParsedChord } from './parseChord';

/** -1 = corda não tocada (x), 0 = solta, n = casa. */
export type Fret = number;

export type Barre = { fret: number; fromString: number; toString: number };

export type Voicing = {
  frets: Fret[];
  /** Dedo de cada corda (0 = nenhum). */
  fingers: number[];
  barre: Barre | null;
  score: number;
};

const MUTED = -1;

export function generateVoicings(chord: ParsedChord, instrument: FrettedInstrument, limit = 8): Voicing[] {
  const { tuning, maxFret, maxSpan } = instrument;
  const n = tuning.length;

  let required = [...chord.required];
  const optional = [...chord.optional];
  // Bass inverted note must sound when the instrument controls the bass.
  const bassInterval = (chord.bass - chord.root + 12) % 12;
  if (instrument.bassMustMatch && !required.includes(bassInterval)) required.push(bassInterval);

  // Instrumento com poucas cordas: tira a raiz quando não couber tudo (comum no cavaco).
  if (required.length > n) required = required.filter((i) => i !== 0);
  if (required.length > n) required = required.slice(0, n);

  const allowed = new Set([...required, ...optional].map((i) => (i + chord.root) % 12));
  const requiredPcs = required.map((i) => (i + chord.root) % 12);

  // Casas possíveis em cada corda
  const options: Fret[][] = tuning.map((open) => {
    const list: Fret[] = [];
    for (let f = 0; f <= maxFret; f++) if (allowed.has((open + f) % 12)) list.push(f);
    if (instrument.allowMutedStrings) list.push(MUTED);
    return list;
  });

  const results: Voicing[] = [];
  const seen = new Set<string>();
  const current: Fret[] = new Array(n).fill(MUTED);

  const walk = (s: number, lo: number, hi: number) => {
    if (s === n) {
      const v = evaluate(current, chord, instrument, requiredPcs);
      if (v) {
        const key = v.frets.join(',');
        if (!seen.has(key)) { seen.add(key); results.push(v); }
      }
      return;
    }
    for (const f of options[s]) {
      let nlo = lo, nhi = hi;
      if (f > 0) {
        nlo = Math.min(lo, f);
        nhi = Math.max(hi, f);
        if (nhi - nlo > maxSpan) continue;
      }
      current[s] = f;
      walk(s + 1, nlo, nhi);
    }
    current[s] = MUTED;
  };
  walk(0, Infinity, -Infinity);

  results.sort((a, b) => a.score - b.score);
  return results.slice(0, limit);
}

function evaluate(frets: Fret[], chord: ParsedChord, inst: FrettedInstrument, requiredPcs: number[]): Voicing | null {
  const n = frets.length;
  const sounding = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  if (sounding.length < Math.min(inst.minSoundingStrings, n)) {
    // Power chord pode ter menos cordas
    const power = chord.required.length <= 2 && chord.optional.length === 0;
    if (!power || sounding.length < 2) return null;
  }

  // Cordas mudas: só no grave (contíguas), no agudo, ou no máximo uma no meio.
  const first = sounding[0];
  const last = sounding[sounding.length - 1];
  let innerMutes = 0;
  for (let i = first; i <= last; i++) if (frets[i] < 0) innerMutes++;
  if (innerMutes > 1) return null;
  const lowMutes = first;
  const highMutes = n - 1 - last;

  // Notas presentes
  const pcs = sounding.map((i) => (inst.tuning[i] + frets[i]) % 12);
  for (const pc of requiredPcs) if (!pcs.includes(pc)) return null;

  // Baixo
  // Nota mais grave pela altura (no ukulele a corda da esquerda é aguda).
  const pitches = sounding.map((i) => inst.tuning[i] + frets[i]);
  const lowestPc = pcs[pitches.indexOf(Math.min(...pitches))];
  if (inst.bassMustMatch && lowestPc !== chord.bass) return null;

  // Dedos e pestana
  const pressed = sounding.filter((i) => frets[i] > 0);
  const minFret = pressed.length ? Math.min(...pressed.map((i) => frets[i])) : 0;
  const maxFret = pressed.length ? Math.max(...pressed.map((i) => frets[i])) : 0;

  let barre: Barre | null = null;
  const atMin = pressed.filter((i) => frets[i] === minFret);
  if (atMin.length >= 2) {
    const from = atMin[0];
    const to = atMin[atMin.length - 1];
    let fits = true;
    for (let i = from; i <= to; i++) if (frets[i] < minFret) { fits = false; break; }
    // Pestana só quando ela é usada de verdade:
    // - faltam dedos sem ela (F "133211", Bm "x24432");
    // - ou cordas vizinhas na mesma casa até a mais aguda (F "xx3211", Dm7 "xx0211").
    // Em "022000", A "x02220" e D "xx0232" cada nota tem o seu dedo.
    const needed = pressed.length > 4;
    const topMiniBarre = to - from + 1 === atMin.length && to === n - 1;
    if (fits && (needed || topMiniBarre)) barre = { fret: minFret, fromString: from, toString: to };
  }

  const fingersNeeded = barre ? 1 + pressed.filter((i) => frets[i] > minFret).length : pressed.length;
  if (fingersNeeded > 4) return null;

  const isPower = chord.required.length <= 2 && chord.optional.length === 0;
  if (isPower && innerMutes > 0) return null;

  const openStrings = sounding.filter((i) => frets[i] === 0);
  const opens = openStrings.length;

  // Pontuação: quanto menor, melhor
  let score = 0;
  score += (pressed.length ? minFret : 0) * 1.4;
  score += (maxFret - (pressed.length ? minFret : 0)) * 1.0;
  score += fingersNeeded * 0.5;
  if (barre) score += 0.4;
  score += lowMutes * 1.5;
  score += highMutes * (isPower ? 0.5 : 3);
  score += innerMutes * 4;
  // Cordas soltas ajudam em posição aberta; misturadas com casas altas soam estranho e são difíceis.
  score += minFret <= 2 || maxFret <= 3 ? -0.3 * opens : 1.2 * opens;
  for (const i of openStrings) {
    // corda solta no meio do desenho
    if (i > first && i < last && pressed.some((p) => p < i) && pressed.some((p) => p > i)) score += 0.4;
    // corda solta grave embaixo de uma casa alta (ex.: Bm "x20402"); no ukulele o G solto é agudo
    if (pressed.some((p) => p > i && frets[p] >= 4 && inst.tuning[p] + frets[p] > inst.tuning[i])) score += 2.5;
  }
  // Terça dobrada soa "pesada"; o comum é dobrar raiz ou quinta.
  const thirdPcs = [3, 4].filter((t) => chord.required.includes(t)).map((t) => (t + chord.root) % 12);
  for (const t of thirdPcs) {
    const count = pcs.filter((pc) => pc === t).length;
    if (count > 1) score += 0.5 * (count - 1);
  }
  // Quinta (opcional) faltando
  const optionalPcs = chord.optional.map((i) => (i + chord.root) % 12);
  for (const pc of optionalPcs) if (!pcs.includes(pc)) score += 1;
  // Raiz no grave é preferível mesmo quando não é obrigatória
  if (!inst.bassMustMatch && lowestPc !== chord.bass) score += 0.8;
  // Raiz presente quando foi possível
  if (!pcs.includes(chord.root)) score += 1.5;

  return { frets: [...frets], fingers: assignFingers(frets, barre), barre, score };
}

/** Numeração de dedos simples: pestana = indicador; demais em ordem de casa e de corda. */
function assignFingers(frets: Fret[], barre: Barre | null): number[] {
  const fingers = frets.map(() => 0);
  let next = 1;
  if (barre) {
    for (let i = barre.fromString; i <= barre.toString; i++) if (frets[i] === barre.fret) fingers[i] = 1;
    next = 2;
  }
  const rest = frets
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => f > 0 && fingers[i] === 0)
    .sort((a, b) => a.f - b.f || a.i - b.i);
  for (const { i } of rest) fingers[i] = Math.min(4, next++);
  return fingers;
}
