/**
 * Detecção de frequência fundamental (YIN, de Cheveigné & Kawahara 2002).
 * Pensado para voz: uma nota por vez, de ~70 Hz a ~1100 Hz.
 */

export type PitchFrame = { freq: number; clarity: number };

const MIN_FREQ = 70;
const MAX_FREQ = 1100;
const THRESHOLD = 0.15;

/** Retorna a frequência (Hz) e a clareza (0..1), ou null se não houver nota clara. */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchFrame | null {
  const tauMin = Math.floor(sampleRate / MAX_FREQ);
  const tauMax = Math.min(Math.floor(sampleRate / MIN_FREQ), Math.floor(buf.length / 2));
  const W = buf.length - tauMax;
  if (W <= 0 || tauMax <= tauMin) return null;

  // 1) Função diferença
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // 2) Diferença média cumulativa normalizada
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  // 3) Primeiro mínimo abaixo do limiar
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < THRESHOLD) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // 4) Interpolação parabólica para precisão abaixo de uma amostra
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1];
    const b = cmnd[tau];
    const c = cmnd[tau + 1];
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }

  const freq = sampleRate / better;
  if (freq < MIN_FREQ || freq > MAX_FREQ) return null;
  return { freq, clarity: 1 - cmnd[tau] };
}

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}
