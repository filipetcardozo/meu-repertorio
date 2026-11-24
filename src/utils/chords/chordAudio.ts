/**
 * Toca o acorde no navegador (Web Audio, sem arquivos de som).
 *
 * - Cordas (violão, cavaco, ukulele): síntese Karplus-Strong (corda dedilhada), com o ponto
 *   onde a corda é tocada, ressonância do corpo, palheta (cavaco) e batida "humana".
 * - Teclado: piano com duas cordas levemente desafinadas por nota, ataque do martelo e
 *   nota mais aguda (melodia) um pouco mais forte.
 * - Tudo passa por um reverb curto de sala e se espalha no estéreo (grave à esquerda).
 *
 * Cada toque pode ser só uma parte do acorde (baixo, agudos, uma corda), abafado, curto ou
 * mais forte/fraco — é o que os ritmos (batidas e dedilhados) usam.
 */
import type { FrettedInstrument, PluckSound } from './instruments';
import { bindVolume } from '../audio/practiceVolume';
import { ensureNotes, noteSample, type NoteBankId } from '../audio/samples';

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
let reverbIn: AudioNode | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let pianoWave: PeriodicWave | null = null;
let noiseBuffer: AudioBuffer | null = null;

/**
 * Toques soando (ou agendados), por canal (um por instrumento), para abafar quando entra outro
 * no mesmo instrumento sem calar os outros (a batida do violão não corta o baixo).
 */
export type Voice = { gain: GainNode; start: number; onDamp?: (t: number) => void };
const pools = new Map<string, Voice[]>();

/** Qual parte do acorde o toque pega. */
export type StrokePart =
  | 'all'      // todas as cordas
  | 'upper'    // as de cima (batida para cima pega mais as agudas)
  | 'bass'     // só o baixo (polegar)
  | 'altBass'  // baixo alternado (a corda grave seguinte)
  | 'treble'   // as três mais agudas juntas (dedos)
  | 'pinch'    // baixo + três agudas juntos (pinça)
  | 't1' | 't2' | 't3'; // uma das três mais agudas (t1 = a mais grave delas)

export type StrokeOptions = {
  /** Quando tocar (relógio do áudio, ver `audioTime`); sem isso, toca agora. */
  when?: number;
  /** Batida de baixo para cima (ordem das cordas invertida). */
  reverse?: boolean;
  part?: StrokePart;
  /** Força: 1 = normal. */
  gain?: number;
  /** Abafado: som percussivo, quase sem nota ("tchá"). */
  muted?: boolean;
  /** Curto (staccato): solta o acorde logo depois do ataque. */
  short?: boolean;
  /** Abafa o que estava soando (padrão). Dedilhado deixa as cordas anteriores soando. */
  damp?: boolean;
  /** Canal (instrumento) do toque: só abafa o que soa no mesmo canal. */
  channel?: string;
  /** Posição no estéreo (-1 esquerda .. 1 direita) do instrumento na banda. */
  pan?: number;
};

/**
 * Resposta de uma sala de estúdio: primeiras reflexões (paredes próximas) e uma cauda estéreo
 * que vai ficando mais escura com o tempo, como numa sala de verdade (os agudos morrem antes).
 */
function roomImpulse(c: AudioContext, seconds = 2.2): AudioBuffer {
  const sr = c.sampleRate;
  const len = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.018);
  const ir = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    // Primeiras reflexões: ecos esparsos nos primeiros ~70 ms, diferentes em cada lado.
    for (let k = 0; k < 14; k++) {
      const idx = pre + Math.floor(Math.random() * sr * 0.07);
      d[idx] += (Math.random() < 0.5 ? -1 : 1) * 0.55 * (1 - k / 14);
    }
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const coef = 0.08 + 0.55 * Math.exp(-t * 1.6);
      lp += coef * ((Math.random() * 2 - 1) - lp);
      d[i] += lp * Math.exp(-t * 3.1) * 0.7;
    }
  }
  return ir;
}

/** Contexto de áudio do app e as entradas da mixagem (saída e reverb). Null sem Web Audio. */
export function audio(): { ctx: AudioContext; out: AudioNode; reverbIn: AudioNode } | null {
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
    // Limitador no fim: a banda inteira junta nunca estoura.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    // Corta o grave que só embola (abaixo do que os instrumentos tocam).
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 32;
    // Folga antes do compressor: com a banda inteira ele só "cola" o som, sem bombear.
    const headroom = ctx.createGain();
    headroom.gain.value = 0.75;
    hp.connect(headroom).connect(comp);
    comp.connect(volume).connect(limiter).connect(ctx.destination);
    out = hp;

    const conv = ctx.createConvolver();
    conv.buffer = roomImpulse(ctx);
    conv.connect(comp);
    reverbIn = conv;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: out!, reverbIn: reverbIn! };
}

/** Relógio do áudio (segundos), para agendar sons no tempo exato. Null sem Web Audio. */
export function audioTime(): number | null {
  return audio()?.ctx.currentTime ?? null;
}

/** Clique de metrônomo em `when` (relógio do áudio); `accent` marca o primeiro tempo do compasso. */
export function playClick(when: number, accent: boolean) {
  const a = audio();
  if (!a) return;
  const { ctx: c } = a;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = accent ? 1760 : 1175;
  const g = c.createGain();
  const level = accent ? 0.32 : 0.2;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(level, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  osc.connect(g).connect(a.out);
  osc.start(when);
  osc.stop(when + 0.06);
}

/** Cala na hora os toques agendados para `time` ou depois (ex.: trocou o acorde de um tempo já agendado). */
export function cancelVoicesFrom(time: number) {
  if (!ctx) return;
  const now = ctx.currentTime;
  pools.forEach((list, key) => {
    pools.set(key, list.filter((v) => {
      if (v.start < time - 0.001) return true;
      silence(v, now);
      return false;
    }));
  });
}

/** Solta rapidinho o que está soando num canal, ou em todos (ex.: parou o "tocar junto"). */
export function releaseVoices(channel?: string) {
  if (!ctx) return;
  const now = ctx.currentTime;
  pools.forEach((list, key) => {
    if (channel && key !== channel) return;
    list.forEach((v) => {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0, now, 0.04);
      v.onDamp?.(now + 0.3);
      window.setTimeout(() => v.gain.disconnect(), 400);
    });
    pools.delete(key);
  });
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

function silence(v: Voice, now: number) {
  v.gain.gain.cancelScheduledValues(0);
  v.gain.gain.setValueAtTime(0, now);
  v.onDamp?.(now + 0.05);
  window.setTimeout(() => v.gain.disconnect(), 100);
}

export type VoiceOptions = {
  lowpassHz?: number;
  body?: PluckSound['body'];
  reverb: number;
  damp: boolean;
  channel?: string;
  pan?: number;
};

/**
 * Começa um novo toque em `t`. Com `damp`, abaixa rapidinho o que estava soando (como abafar
 * as cordas) e troca o que estava agendado para depois. Sem `damp` (dedilhado), soma ao que soa.
 * Caminho: notas → corpo (EQ) → corte de agudos → saída, e um pouco para o reverb.
 */
function newVoice(c: AudioContext, dest: AudioNode, reverb: AudioNode, opts: VoiceOptions, t: number): Voice {
  const now = c.currentTime;
  const channel = opts.channel ?? 'chord';
  const list = (pools.get(channel) ?? []).filter((v) => {
    if (opts.damp) {
      if (v.start >= t - 0.005) {
        silence(v, now);
      } else {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.02);
        v.onDamp?.(t + 0.2);
        window.setTimeout(() => v.gain.disconnect(), Math.max(0, t - now) * 1000 + 300);
      }
      return false;
    }
    // Sem abafar: só larga os que já acabaram de soar.
    if (v.start < now - 6) {
      v.gain.disconnect();
      return false;
    }
    return true;
  });

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
  if (opts.pan) {
    const pan = c.createStereoPanner();
    pan.pan.value = opts.pan;
    node.connect(pan);
    node = pan;
  }
  node.connect(dest);

  const send = c.createGain();
  send.gain.value = opts.reverb;
  node.connect(send).connect(reverb);

  const v: Voice = { gain: voice, start: t };
  list.push(v);
  pools.set(channel, list);
  return v;
}

/** Abre um toque novo no canal (para outros sintetizadores do app, ex.: banda). */
export function openVoice(t: number, opts: VoiceOptions): Voice | null {
  const a = audio();
  if (!a) return null;
  return newVoice(a.ctx, a.out, a.reverbIn, opts, t);
}

/** Envelope do toque inteiro: abafado some quase na hora; curto solta logo depois do ataque. */
function shapeVoice(voice: GainNode, t: number, opts: StrokeOptions) {
  if (opts.muted) {
    voice.gain.setValueAtTime(1, t);
    voice.gain.setTargetAtTime(0, t + 0.012, 0.012);
  } else if (opts.short) {
    voice.gain.setValueAtTime(1, t);
    voice.gain.setTargetAtTime(0, t + 0.13, 0.03);
  }
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

/**
 * Uma nota de corda dedilhada (ex.: baixo): gravada (bank), ou sintetizada com o timbre `sound`
 * enquanto a gravação não carregou.
 */
export function playPluckNote(key: string, sound: PluckSound, midi: number, opts: StrokeOptions = {}, bank?: NoteBankId) {
  const a = audio();
  if (!a) return;
  const { ctx: c } = a;
  const t = Math.max(opts.when ?? 0, c.currentTime + 0.02);
  if (bank) ensureNotes(c, bank);
  const smp = bank ? noteSample(bank, midi) : null;
  const level = opts.gain ?? 1;
  const voice = newVoice(c, a.out, a.reverbIn, smp
    ? { lowpassHz: 1200 + 3000 * Math.min(1, level), reverb: 0.05, damp: opts.damp ?? true, channel: opts.channel, pan: opts.pan }
    : { lowpassHz: sound.lowpassHz, body: sound.body, reverb: sound.reverb, damp: opts.damp ?? true, channel: opts.channel, pan: opts.pan }, t).gain;
  shapeVoice(voice, t, opts);
  const src = c.createBufferSource();
  const g = c.createGain();
  if (smp) {
    src.buffer = smp.sample.buffer;
    src.playbackRate.value = smp.rate;
    g.gain.value = 0.75 * level * smp.sample.gain;
    src.connect(g).connect(voice);
    src.start(t, smp.sample.offset);
  } else {
    const { buffer, rate } = pluckBuffer(c, key, midiToFreq(midi), sound);
    src.buffer = buffer;
    src.playbackRate.value = rate;
    g.gain.value = 0.7 * level;
    src.connect(g).connect(voice);
    src.start(t);
  }
}

/** Escolhe as cordas do toque (na ordem física), a partir das que soam no acorde. */
function pickStrings(sounding: { i: number; midi: number }[], part: StrokePart) {
  if (part === 'all' || sounding.length === 0) return sounding;
  const byPitch = [...sounding].sort((a, b) => a.midi - b.midi);
  const bass = byPitch[0];
  // As agudas são as últimas cordas na ordem física, sem contar o baixo.
  const rest = sounding.filter((s) => s !== bass);
  const treble = rest.slice(-3);
  switch (part) {
    case 'upper': return sounding.slice(-Math.min(sounding.length, 4));
    case 'bass': return [bass];
    case 'altBass': return [byPitch[1] ?? bass];
    case 'treble': return treble;
    case 'pinch': return [bass, ...treble];
    case 't1': return [treble[0] ?? bass];
    case 't2': return [treble[1] ?? treble[0] ?? bass];
    case 't3': return [treble[2] ?? treble[treble.length - 1] ?? bass];
  }
}

/**
 * Toca uma digitação de instrumento de cordas (frets: -1 = corda não tocada).
 * Ver `StrokeOptions` para tocar só uma parte, abafado, curto, para cima ou agendado.
 */
export function playFretted(instrument: FrettedInstrument, frets: number[], opts: StrokeOptions = {}) {
  const a = audio();
  if (!a) return;
  const { ctx: c } = a;
  const s = instrument.sound;
  const part = opts.part ?? 'all';
  let t = Math.max(opts.when ?? 0, c.currentTime + 0.02);
  const bank = instrument.samples;
  if (bank) ensureNotes(c, bank);
  // Gravado se o instrumento já carregou; senão, sintetizado.
  const sampled = !!bank && noteSample(bank, instrument.tuning[0] + 12) != null;
  const strength = Math.min(1, opts.gain ?? 1);
  const tone = instrument.sampleTone;
  const voice = newVoice(c, a.out, a.reverbIn, sampled
    // Toque mais fraco soa mais escuro, como na mão.
    ? {
      lowpassHz: ((opts.muted ? 1500 : 2800) + 9000 * strength * strength) * (tone?.bright ?? 1),
      body: tone?.body, reverb: 0.2, damp: opts.damp ?? true, channel: opts.channel, pan: opts.pan,
    }
    : { lowpassHz: s.lowpassHz, body: s.body, reverb: s.reverb, damp: opts.damp ?? true, channel: opts.channel, pan: opts.pan }, t).gain;
  shapeVoice(voice, t, opts);
  // Instrumento de corda mais curta (cavaco, banjo): a nota morre antes.
  if (sampled && tone?.decay && !opts.muted && !opts.short) {
    voice.gain.setValueAtTime(1, t);
    voice.gain.setTargetAtTime(0, t + 0.08, tone.decay);
  }

  // Batida na ordem física das cordas (no ukulele o G agudo vem primeiro, como na mão); `reverse` volta pelo outro lado
  const sounding = frets.map((f, i) => ({ i, midi: instrument.tuning[i] + f, f })).filter(({ f }) => f >= 0);
  const order = pickStrings(sounding, part);
  if (opts.reverse) order.reverse();
  const strings = frets.length;
  // Dedilhado (pinça, agudos juntos) soa junto, sem o "arrastar" da batida.
  const together = part === 'treble' || part === 'pinch';
  const level = (opts.gain ?? 1) * (opts.muted ? 0.8 : 1);
  const base = (0.55 * level) / Math.sqrt(Math.max(1, part === 'all' || part === 'upper' ? order.length : 3));

  order.forEach(({ i, midi }, k) => {
    const smp = sampled ? noteSample(bank!, midi) : null;
    const { buffer, rate } = smp ? { buffer: smp.sample.buffer, rate: smp.rate } : pluckBuffer(c, instrument.id, midiToFreq(midi), s);
    // Mão humana: tempo e força variam um pouco; a batida acelera levemente
    if (k > 0) t += together ? rand(0, 0.006) : (s.strumMs / 1000) * rand(0.8, 1.2) * (1 - k * 0.04);
    const gain = base * rand(0.85, 1) * (1.08 - (i / Math.max(1, strings - 1)) * 0.16);

    const pan = c.createStereoPanner();
    pan.pan.value = (-0.35 + 0.7 * (i / Math.max(1, strings - 1))) * (sampled ? 0.5 : 1);
    pan.connect(voice);

    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = smp ? gain * smp.sample.gain * 0.8 : gain;
    src.connect(g).connect(pan);
    src.start(t, smp ? smp.sample.offset : 0);

    // Palheta raspando a corda; no abafado, o "tchá" da mão batendo nas cordas
    const noise = opts.muted ? Math.max(0.6, s.pickNoise) : sampled ? 0 : s.pickNoise;
    if (noise > 0) {
      const nz = c.createBufferSource();
      nz.buffer = getNoise(c);
      const hp = c.createBiquadFilter();
      hp.type = opts.muted ? 'bandpass' : 'highpass';
      hp.frequency.value = opts.muted ? 1800 : 2500;
      const ng = c.createGain();
      ng.gain.setValueAtTime(gain * noise, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + (opts.muted ? 0.03 : 0.015));
      nz.connect(hp).connect(ng).connect(pan);
      nz.start(t);
      nz.stop(t + 0.04);
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

/** Notas do teclado para cada parte do toque (o baixo fica na mão esquerda). */
function pickKeys(notes: number[], bass: number | null, part: StrokePart): number[] {
  const sorted = [...notes].sort((a, b) => a - b);
  const low = bass ?? sorted[0] - 12;
  const top = sorted.slice(-3);
  switch (part) {
    case 'all': return bass != null ? [bass, ...notes] : notes;
    case 'upper': case 'treble': return notes;
    case 'bass': return [low];
    case 'altBass': return [low + 7];
    case 'pinch': return [low, ...notes];
    case 't1': return [top[0]];
    case 't2': return [top[1] ?? top[0]];
    case 't3': return [top[top.length - 1]];
  }
}

/**
 * Toca as notas do teclado juntas (com o baixo da mão esquerda, se houver).
 * Ver `StrokeOptions` para tocar só uma parte, curto, mais forte/fraco ou agendado.
 */
export function playKeyboard(notes: number[], bass: number | null, opts: StrokeOptions = {}) {
  const a = audio();
  if (!a) return;
  const { ctx: c } = a;
  const t0 = Math.max(opts.when ?? 0, c.currentTime + 0.02);
  ensureNotes(c, 'piano');
  const sampled = noteSample('piano', 60) != null;
  const strength = Math.min(1, opts.gain ?? 1);
  const voice = newVoice(c, a.out, a.reverbIn, {
    reverb: sampled ? 0.22 : 0.28, damp: opts.damp ?? true, channel: opts.channel, pan: opts.pan,
    // Piano gravado: toque mais leve, som mais aveludado.
    lowpassHz: sampled ? 2500 + 12000 * strength * strength : undefined,
  }, t0).gain;
  // No teclado, "abafado" vira um acorde bem curto.
  shapeVoice(voice, t0, opts.muted ? { short: true } : opts);
  const all = pickKeys(notes, bass, opts.part ?? 'all');
  const top = Math.max(...all);
  const base = (0.4 * (opts.gain ?? 1) * (opts.muted ? 0.6 : 1)) / Math.sqrt(Math.max(all.length, 3));

  if (sampled) {
    all.forEach((midi, k) => {
      const smp = noteSample('piano', midi);
      if (!smp) return;
      const t = t0 + k * 0.007 + rand(0, 0.006);
      const src = c.createBufferSource();
      src.buffer = smp.sample.buffer;
      src.playbackRate.value = smp.rate;
      const g = c.createGain();
      g.gain.value = base * 1.6 * smp.sample.gain * (midi === top ? 1.15 : 1) * rand(0.9, 1);
      const pan = c.createStereoPanner();
      pan.pan.value = Math.max(-0.4, Math.min(0.4, (midi - 60) / 40));
      src.connect(g).connect(pan).connect(voice);
      src.start(t, smp.sample.offset);
    });
    return;
  }

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
