/**
 * Teoria musical para o afinador e a detecção de tom.
 *
 * Detecção de tom: somamos quanto tempo a pessoa cantou cada uma das 12 notas (sem oitava)
 * e comparamos com o "perfil" da música, tirado dos acordes da própria cifra
 * (fundamental, terça, quinta, sétima...). Giramos esse perfil nos 12 tons possíveis:
 * o giro que mais se parece com o que foi cantado diz quantos semitons a pessoa está
 * acima/abaixo da cifra. Sem acordes, usamos o perfil clássico de tonalidade (Krumhansl).
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiToName(midi: number): { name: string; octave: number } {
  const n = Math.round(midi);
  return { name: NOTE_NAMES[mod12(n)], octave: Math.floor(n / 12) - 1 };
}

/** "C", "F#m", "Bb" -> { tonic, minor } */
export function parseKey(key: string | null | undefined): { tonic: number; minor: boolean } | null {
  const m = key?.trim().match(/^([A-G])([#b]?)(m(?!aj))?/);
  if (!m) return null;
  const tonic = mod12(NATURAL[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  return { tonic, minor: !!m[3] };
}

export function keyName(tonic: number, minor: boolean): string {
  return NOTE_NAMES[mod12(tonic)] + (minor ? 'm' : '');
}

const CHORD_RE = /^([A-G])([#b]?)([^/\s]*)(?:\/([A-G])([#b]?))?$/;

/** Notas (classes 0..11) de um acorde cifrado, com peso. null se não for acorde. */
export function chordTones(symbol: string): [number, number][] | null {
  const m = symbol.trim().match(CHORD_RE);
  if (!m) return null;
  const root = mod12(NATURAL[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  const q = m[3];
  if (q && !/^(m|maj|min|dim|aug|sus|add|M|°|º|\+|[0-9(])/.test(q)) return null;
  // "Amor", "Dele"... são palavras, não acordes (mas "Am7", "Amaj7", "Am(9)" são).
  if (/^m[a-z]/.test(q) && !/^m(aj|in|add|sus|dim)/.test(q)) return null;

  const minor = /^(m(?!aj)|min)/.test(q);
  const dim = /dim|°|º|m7?\(?b5/.test(q);
  const aug = /aug|^\+|\(#5\)|5\+/.test(q);
  const third = /sus2/.test(q) ? 2 : /sus/.test(q) ? 5 : minor || dim ? 3 : 4;
  const fifth = dim ? 6 : aug ? 8 : 7;

  const tones: [number, number][] = [[root, 1], [root + third, 0.8], [root + fifth, 0.6]];
  if (/7M|maj7|M7|7\+/.test(q)) tones.push([root + 11, 0.4]);
  else if (/7/.test(q)) tones.push([root + (dim && /°|º|dim7/.test(q) ? 9 : 10), 0.4]);
  if (/9/.test(q)) tones.push([root + 2, 0.3]);
  if (/6/.test(q)) tones.push([root + 9, 0.3]);
  if (m[4]) tones.push([NATURAL[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0), 0.4]);
  return tones.map(([pc, w]) => [mod12(pc), w]);
}

/** Perfil de notas da música a partir dos acordes que aparecem na cifra. */
export function profileFromChords(symbols: string[]): number[] | null {
  const p = new Array(12).fill(0);
  let count = 0;
  for (const s of symbols) {
    const tones = chordTones(s);
    if (!tones) continue;
    count++;
    for (const [pc, w] of tones) p[pc] += w;
  }
  return count >= 2 ? p : null;
}

// Krumhansl-Kessler (C maior / C menor)
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function profileFromKey(tonic: number, minor: boolean): number[] {
  const base = minor ? KK_MINOR : KK_MAJOR;
  return Array.from({ length: 12 }, (_, i) => base[mod12(i - tonic)]);
}

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / 12;
  const mb = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export type KeyEstimate =
  | { status: 'in-key'; confidence: number }
  | { status: 'shifted'; semitones: number; confidence: number }
  | { status: 'unsure' };

/**
 * Compara o que foi cantado (histograma de 12 notas) com o perfil da música.
 * semitones > 0: a pessoa canta acima da cifra.
 */
export function estimateShift(sung: number[], profile: number[]): KeyEstimate {
  const scores = Array.from({ length: 12 }, (_, k) =>
    correlation(sung, Array.from({ length: 12 }, (_, i) => profile[mod12(i - k)])),
  );
  let best = 0;
  for (let k = 1; k < 12; k++) if (scores[k] > scores[best]) best = k;
  const second = Math.max(...scores.filter((_, k) => k !== best));

  if (best === 0) {
    return scores[0] >= 0.45 ? { status: 'in-key', confidence: scores[0] } : { status: 'unsure' };
  }
  // Só sugere mudar se a diferença para o tom atual (e para o 2º lugar) for clara.
  if (scores[best] >= 0.55 && scores[best] - scores[0] >= 0.15 && scores[best] - second >= 0.05) {
    return { status: 'shifted', semitones: best > 6 ? best - 12 : best, confidence: scores[best] };
  }
  return { status: 'unsure' };
}

/** 1 -> "meio tom", 2 -> "1 tom", 3 -> "1 tom e meio"... */
export function describeSemitones(n: number): string {
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 2);
  const half = abs % 2 === 1;
  if (whole === 0) return 'meio tom';
  const tons = whole === 1 ? '1 tom' : `${whole} tons`;
  return half ? `${tons} e meio` : tons;
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

/** As 7 notas do tom, em semitons acima da tônica. */
export function scaleSteps(minor: boolean): number[] {
  return minor ? MINOR_STEPS : MAJOR_STEPS;
}

/** Tom mais provável de um perfil (ex.: acordes da cifra), entre os 24 maiores/menores. */
export function keyFromProfile(profile: number[]): { tonic: number; minor: boolean } {
  let best = { tonic: 0, minor: false, score: -Infinity };
  for (const minor of [false, true]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const score = correlation(profile, profileFromKey(tonic, minor));
      if (score > best.score) best = { tonic, minor, score };
    }
  }
  return { tonic: best.tonic, minor: best.minor };
}

/**
 * Altura (MIDI) da tônica para tocar as notas de referência perto da voz de quem canta.
 * Sem informação da voz, usa a oitava do Dó central (C4..B4).
 */
export function tonicMidiNear(tonic: number, voiceCenter: number | null): number {
  const center = voiceCenter ?? 64;
  // tônica entre ~1 quinta abaixo e ~1 quarta acima do centro da voz
  let m = 60 + mod12(tonic);
  while (m > center + 5) m -= 12;
  while (m < center - 7) m += 12;
  return m;
}

/**
 * Distância (em semitons) entre o que foi cantado e a nota-alvo, na oitava mais próxima.
 * > 0: cantando acima do alvo.
 */
export function distanceToTarget(sungMidi: number, targetMidi: number): number {
  const d = sungMidi - targetMidi;
  return d - 12 * Math.round(d / 12);
}
