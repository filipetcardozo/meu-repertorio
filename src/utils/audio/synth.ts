/**
 * Sintetizador simples (Web Audio) para dar notas de referência: som suave tipo piano elétrico.
 * O afinador consulta `isSynthSounding()` para não contar o próprio som tocado como canto.
 */

import { bindVolume } from './practiceVolume';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let wave: PeriodicWave | null = null;
let soundingUntil = 0;
let voices: { osc: OscillatorNode; gain: GainNode }[] = [];

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    bindVolume(master, ctx, 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    master.connect(lp).connect(ctx.destination);
    // Harmônicos decrescentes: timbre redondo, fácil de ouvir a altura.
    const real = new Float32Array([0, 1, 0.42, 0.22, 0.12, 0.06, 0.03]);
    wave = ctx.createPeriodicWave(real, new Float32Array(real.length));
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { });
  return { ctx, master: master!, wave: wave! };
}

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

function voice(midi: number, start: number, duration: number, level: number) {
  const { ctx: c, master: out, wave: w } = audio();
  const osc = c.createOscillator();
  osc.setPeriodicWave(w);
  osc.frequency.value = midiToFreq(midi);
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(level, start + 0.015);
  g.gain.exponentialRampToValueAtTime(level * 0.55, start + 0.35);
  g.gain.setValueAtTime(level * 0.55, start + duration);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.6);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.65);
  const v = { osc, gain: g };
  voices.push(v);
  osc.onended = () => { voices = voices.filter((x) => x !== v); };
  soundingUntil = Math.max(soundingUntil, performance.now() + (start - c.currentTime + duration + 0.75) * 1000);
}

/** Para tudo que está tocando. */
export function stopSynth() {
  if (!ctx) return;
  const now = ctx.currentTime;
  voices.forEach(({ osc, gain }) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.03);
    try { osc.stop(now + 0.15); } catch { }
  });
  voices = [];
  soundingUntil = performance.now() + 150;
}

export function playNote(midi: number, duration = 1.6) {
  stopSynth();
  const { ctx: c } = audio();
  voice(midi, c.currentTime + 0.02, duration, 0.5);
}

/** Acorde dedilhado e, em seguida, a nota principal sustentada ("dar o tom"). */
export function playKeyReference(tonicMidi: number, minor: boolean) {
  stopSynth();
  const { ctx: c } = audio();
  const t = c.currentTime + 0.03;
  const chord = [tonicMidi - 12, tonicMidi, tonicMidi + (minor ? 3 : 4), tonicMidi + 7];
  chord.forEach((m, i) => voice(m, t + i * 0.06, 1.1, 0.28));
  voice(tonicMidi, t + 1.4, 1.6, 0.5);
}

export function isSynthSounding() {
  return performance.now() < soundingUntil;
}

/** Avisa que outro som do app está tocando (ex.: acorde), para o afinador ignorá-lo. */
export function markSounding(ms: number) {
  soundingUntil = Math.max(soundingUntil, performance.now() + ms);
}
