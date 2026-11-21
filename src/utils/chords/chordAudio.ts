/**
 * Toca o acorde no navegador (Web Audio, sem arquivos de som).
 *
 * - Cordas (violão, cavaco, ukulele): síntese Karplus-Strong (corda dedilhada), com o ponto
 *   onde a corda é tocada, ressonância do corpo, palheta (cavaco) e batida "humana".
 * - Teclado: piano com duas cordas levemente desafinadas por nota, ataque do martelo e
 *   nota mais aguda (melodia) um pouco mais forte.
 * - Tudo passa por um reverb curto de sala e se espalha no estéreo (grave à esquerda).
 */
import type { FrettedInstrument, PluckSound } from './instruments';
import { bindVolume } from '../audio/practiceVolume';

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
let reverbIn: AudioNode | null = null;
let current: GainNode | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let pianoWave: PeriodicWave | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** Resposta de uma sala pequena: ruído estéreo que decai, sem agudos ásperos. */
function roomImpulse(c: AudioContext, seconds = 1.6): AudioBuffer {
  const sr = c.sampleRate;
  const len = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.012);
  const ir = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      lp += 0.45 * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-t * 3.6);
    }
  }
  return ir;
}

function audio(): { ctx: AudioContext; out: AudioNode; reverbIn: AudioNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    // Compressor evita estourar quando muitas notas soam juntas.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    // Volume dos sons do app (controle no painel do afinador).
    const volume = ctx.createGain();
    bindVolume(volume, ctx);
    comp.connect(volume).connect(ctx.destination);
    out = comp;

    const conv = ctx.createConvolver();
    conv.buffer = roomImpulse(ctx);
    conv.connect(comp);
    reverbIn = conv;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: out!, reverbIn: reverbIn! };
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

type VoiceOptions = {
  lowpassHz?: number;
  body?: PluckSound['body'];
  reverb: number;
};

/**
 * Começa um novo acorde, abaixando rapidinho o anterior (como abafar as cordas).
 * Caminho: notas → corpo (EQ) → corte de agudos → saída, e um pouco para o reverb.
 */
function newVoice(c: AudioContext, dest: AudioNode, reverb: AudioNode, opts: VoiceOptions): GainNode {
  const t = c.currentTime;
  if (current) {
    current.gain.cancelScheduledValues(t);
    current.gain.setValueAtTime(current.gain.value, t);
    current.gain.linearRampToValueAtTime(0, t + 0.06);
    const old = current;
    window.setTimeout(() => old.disconnect(), 250);
  }
  const voice = c.createGain();
  voice.gain.value = 1;

  let node: AudioNode = voice;
  for (const b of opts.body ?? []) {
    const peak = c.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = b.hz;
    peak.Q.value = b.q;
    peak.gain.value = b.db;
    node.connect(peak);
    node = peak;
  }
  if (opts.lowpassHz) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts.lowpassHz;
    lp.Q.value = 0.5;
    node.connect(lp);
    node = lp;
  }
  node.connect(dest);

  const send = c.createGain();
  send.gain.value = opts.reverb;
  node.connect(send).connect(reverb);

  current = voice;
  return voice;
}

/** Corda dedilhada (Karplus-Strong). Afinação exata via playbackRate. */
function pluckBuffer(c: AudioContext, key: string, freq: number, s: PluckSound): { buffer: AudioBuffer; rate: number } {
  const sr = c.sampleRate;
  const n = Math.max(2, Math.floor(sr / freq - 0.5));
  const rate = freq / (sr / (n + 0.5)); // o laço tem atraso de n + 0,5 amostras
  const cacheKey = `${key}:${n}:${sr}`;
  const cached = bufferCache.get(cacheKey);
  if (cached) return { buffer: cached, rate };

  // Cordas graves soam mais tempo que as agudas
  const sustain = s.sustain * Math.min(1.4, Math.max(0.6, Math.pow(196 / freq, 0.35)));
  const len = Math.floor(sr * sustain);
  const buffer = c.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);

  // Excitação: ruído; "softness" suaviza o ataque (dedo/nylon) em vez de palheta/aço
  const raw = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    prev += (1 - s.softness) * ((Math.random() * 2 - 1) - prev);
    raw[i] = prev;
  }
  // Ponto de toque: tocar a corda a 1/k do comprimento apaga os harmônicos múltiplos de k
  const offset = Math.max(1, Math.round(s.pluckPosition * n));
  const line = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    line[i] = raw[i] - raw[(i - offset + n) % n];
    mean += line[i];
  }
  mean /= n;
  let peak = 0;
  for (let i = 0; i < n; i++) { line[i] -= mean; peak = Math.max(peak, Math.abs(line[i])); }
  if (peak > 0) for (let i = 0; i < n; i++) line[i] /= peak;

  // Decaimento por período para chegar a -60 dB em "sustain" segundos
  const rho = Math.pow(0.001, (n + 0.5) / (sr * sustain));
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = line[idx];
    const b = line[(idx + 1) % n];
    data[i] = a;
    line[idx] = rho * 0.5 * (a + b);
    idx = (idx + 1) % n;
  }
  // Final sem estalo
  const fade = Math.min(len, Math.floor(sr * 0.05));
  for (let i = 0; i < fade; i++) data[len - 1 - i] *= i / fade;

  bufferCache.set(cacheKey, buffer);
  return { buffer, rate };
}

/** Toca uma digitação de instrumento de cordas (frets: -1 = corda não tocada). */
export function playFretted(instrument: FrettedInstrument, frets: number[]) {
  const a = audio();
  if (!a) return;
  const { ctx: c } = a;
  const s = instrument.sound;
  const voice = newVoice(c, a.out, a.reverbIn, { lowpassHz: s.lowpassHz, body: s.body, reverb: s.reverb });

  // Batida para baixo, na ordem física das cordas (no ukulele o G agudo vem primeiro, como na mão)
  const order = frets.map((f, i) => ({ f, i })).filter(({ f }) => f >= 0);
  const strings = frets.length;
  const base = 0.55 / Math.sqrt(Math.max(1, order.length));
  let t = c.currentTime + 0.02;

  order.forEach(({ f, i }, k) => {
    const midi = instrument.tuning[i] + f;
    const { buffer, rate } = pluckBuffer(c, instrument.id, midiToFreq(midi), s);
    // Mão humana: tempo e força variam um pouco; a batida acelera levemente
    if (k > 0) t += (s.strumMs / 1000) * rand(0.8, 1.2) * (1 - k * 0.04);
    const gain = base * rand(0.85, 1) * (1.08 - (i / Math.max(1, strings - 1)) * 0.16);

    const pan = c.createStereoPanner();
    pan.pan.value = -0.35 + 0.7 * (i / Math.max(1, strings - 1));
    pan.connect(voice);

    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g).connect(pan);
    src.start(t);

    // Palheta raspando a corda
    if (s.pickNoise > 0) {
      const nz = c.createBufferSource();
      nz.buffer = getNoise(c);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const ng = c.createGain();
      ng.gain.setValueAtTime(gain * s.pickNoise, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
      nz.connect(hp).connect(ng).connect(pan);
      nz.start(t);
      nz.stop(t + 0.03);
    }
  });
}

function getPianoWave(c: AudioContext) {
  if (!pianoWave) {
    const harmonics = [0, 1, 0.55, 0.32, 0.22, 0.12, 0.08, 0.05, 0.035, 0.02];
    pianoWave = c.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
  }
  return pianoWave;
}

/** Toca as notas do teclado juntas (com o baixo da mão esquerda, se houver). */
export function playKeyboard(notes: number[], bass: number | null) {
  const a = audio();
  if (!a) return;
  const { ctx: c } = a;
  const voice = newVoice(c, a.out, a.reverbIn, { reverb: 0.28 });
  const all = bass != null ? [bass, ...notes] : notes;
  const top = Math.max(...notes);
  const base = 0.4 / Math.sqrt(all.length);
  const t0 = c.currentTime + 0.02;

  all.forEach((midi, k) => {
    const f = midiToFreq(midi);
    const t = t0 + k * 0.006 + rand(0, 0.004); // dedos nunca caem exatamente juntos
    // Notas graves soam mais tempo que as agudas, como no piano
    const dur = Math.min(4.5, Math.max(1.5, 4.5 - (midi - 48) * 0.05));
    // Melodia (nota de cima) e baixo um pouco mais fortes
    const gain = base * (midi === top ? 1.18 : midi === bass ? 1.1 : 1) * rand(0.92, 1);

    const pan = c.createStereoPanner();
    pan.pan.value = Math.max(-0.45, Math.min(0.45, (midi - 60) / 36));
    pan.connect(voice);

    // O som começa brilhante e vai ficando mais escuro
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f * 10, 14000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 500), t + dur * 0.6);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(gain * 0.3, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(pan);

    // Duas cordas por nota, levemente desafinadas (o "coro" natural do piano)
    for (const cents of [-2.5, 2.5]) {
      const osc = c.createOscillator();
      osc.setPeriodicWave(getPianoWave(c));
      osc.frequency.value = f;
      osc.detune.value = cents;
      const half = c.createGain();
      half.gain.value = 0.6;
      osc.connect(half).connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    // Batida do martelo
    const nz = c.createBufferSource();
    nz.buffer = getNoise(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(f * 4, 6000);
    bp.Q.value = 1.2;
    const ng = c.createGain();
    ng.gain.setValueAtTime(gain * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    nz.connect(bp).connect(ng).connect(pan);
    nz.start(t);
    nz.stop(t + 0.04);
  });
}
