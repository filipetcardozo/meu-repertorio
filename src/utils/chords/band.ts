/**
 * Banda do "tocar junto": os instrumentos que podem tocar junto com o acorde atual e os
 * sons que não são de corda de acorde (bateria, baixo, sanfona).
 *
 * Os sons são gravações de instrumentos de verdade (ver utils/audio/samples). Enquanto um
 * instrumento carrega, toca uma versão sintetizada para não ficar em silêncio:
 * - Bateria: bumbo, caixa, chimbal, aro, surdo/zabumba, triângulo, pandeiro e ganzá.
 * - Baixo: uma nota por vez, raiz/quinta conforme o ritmo.
 * - Sanfona: acorde na mão direita e baixos na mão esquerda.
 * - Guitarra: limpa, mesmas digitações do violão.
 */
import { audio, openVoice, playPluckNote, type StrokeOptions } from './chordAudio';
import { drumSample, ensureDrums, ensureNotes, noteSample, type NoteBankId, type Sample } from '../audio/samples';
import type { FrettedInstrument, PluckSound } from './instruments';
import { getInstrument } from './instruments';
import { parseChord } from './parseChord';
import { generateKeyboardVoicings } from './keyboardVoicings';

/** Percussão (cada uma é um músico da banda, com a própria levada em cada ritmo). */
export type PercId = 'surdo' | 'rebolo' | 'pandeiro' | 'tamborim' | 'ganza' | 'triangulo' | 'zabumba';

export type BandPartId =
  | 'violao' | 'cavaquinho' | 'banjo' | 'ukulele' | 'guitarra' | 'teclado' | 'sanfona' | 'baixo' | 'bateria'
  | PercId;

export type BandPart = {
  id: BandPartId;
  name: string;
  /** Como o instrumento toca o ritmo: batida/dedilhado de acorde, baixo, sanfona, bateria ou percussão. */
  role: 'chord' | 'bass' | 'sanfona' | 'drums' | 'perc';
  /** Instrumento de acorde usado (ids de `instruments.ts` ou a guitarra daqui). */
  instrumentId?: string;
  /** Volume relativo na mistura. */
  level: number;
  /** Lugar no palco (estéreo): -1 esquerda .. 1 direita. */
  pan: number;
  /** Gravações que o instrumento usa (para carregar antes de tocar). */
  bank: NoteBankId | 'drums';
};

export const BAND_PARTS: BandPart[] = [
  { id: 'violao', name: 'Violão', role: 'chord', instrumentId: 'guitar', level: 0.85, pan: -0.25, bank: 'violao' },
  { id: 'cavaquinho', name: 'Cavaco', role: 'chord', instrumentId: 'cavaquinho', level: 0.95, pan: 0.35, bank: 'aco' },
  { id: 'banjo', name: 'Banjo', role: 'chord', instrumentId: 'banjo', level: 0.85, pan: -0.4, bank: 'aco' },
  { id: 'ukulele', name: 'Ukulele', role: 'chord', instrumentId: 'ukulele', level: 0.95, pan: 0.3, bank: 'violao' },
  { id: 'guitarra', name: 'Guitarra', role: 'chord', instrumentId: 'electric-guitar', level: 0.6, pan: 0.4, bank: 'guitarra' },
  { id: 'teclado', name: 'Teclado', role: 'chord', instrumentId: 'keyboard', level: 0.7, pan: 0.05, bank: 'piano' },
  { id: 'sanfona', name: 'Sanfona', role: 'sanfona', level: 0.6, pan: 0.2, bank: 'sanfona' },
  { id: 'baixo', name: 'Baixo', role: 'bass', level: 0.55, pan: 0, bank: 'baixo' },
  { id: 'bateria', name: 'Bateria', role: 'drums', level: 1.4, pan: 0, bank: 'drums' },
  { id: 'surdo', name: 'Surdo', role: 'perc', level: 1.3, pan: 0, bank: 'drums' },
  { id: 'rebolo', name: 'Rebolo', role: 'perc', level: 1.1, pan: -0.35, bank: 'drums' },
  { id: 'pandeiro', name: 'Pandeiro', role: 'perc', level: 1, pan: 0.3, bank: 'drums' },
  { id: 'tamborim', name: 'Tamborim', role: 'perc', level: 0.8, pan: 0.45, bank: 'drums' },
  { id: 'ganza', name: 'Ganzá', role: 'perc', level: 0.75, pan: -0.2, bank: 'drums' },
  { id: 'triangulo', name: 'Triângulo', role: 'perc', level: 0.9, pan: 0.4, bank: 'drums' },
  { id: 'zabumba', name: 'Zabumba', role: 'perc', level: 1.3, pan: 0, bank: 'drums' },
];

export const PERC_IDS: PercId[] = ['surdo', 'rebolo', 'pandeiro', 'tamborim', 'ganza', 'triangulo', 'zabumba'];
export const isPerc = (id: BandPartId): id is PercId => (PERC_IDS as string[]).includes(id);

/** Banda inicial: a percussão vem ligada (só toca nos ritmos que a usam). */
export const DEFAULT_BAND: BandPartId[] = ['violao', 'baixo', 'bateria', ...PERC_IDS];

/** Guitarra elétrica (limpa): braço e afinação do violão, corda de aço com palheta. */
export const ELECTRIC_GUITAR: FrettedInstrument = {
  ...(getInstrument('guitar') as FrettedInstrument),
  id: 'electric-guitar',
  name: 'Guitarra',
  sound: {
    sustain: 2.6, softness: 0.08, lowpassHz: 5200, strumMs: 14, pluckPosition: 0.1,
    body: [{ hz: 180, q: 1, db: 2 }, { hz: 2400, q: 1.2, db: 4 }],
    reverb: 0.25, pickNoise: 0.25,
  },
  samples: 'guitarra',
};

/**
 * Banjo do pagode: afinado como o cavaco (D G B D), som seco e estalado (pele em vez de tampo).
 * Usa as gravações do violão de aço com nota curta e bem mais brilho.
 */
export const BANJO: FrettedInstrument = {
  ...(getInstrument('cavaquinho') as FrettedInstrument),
  id: 'banjo',
  name: 'Banjo',
  samples: 'aco',
  sampleTone: { decay: 0.28, bright: 1.6, body: [{ hz: 2400, q: 1.4, db: 6 }, { hz: 180, q: 1, db: -8 }] },
};

/** Instrumentos de acorde que só existem na banda (não aparecem no desenho dos acordes). */
export const BAND_ONLY_INSTRUMENTS: FrettedInstrument[] = [ELECTRIC_GUITAR, BANJO];

/** Começa a carregar as gravações de um instrumento da banda (sem esperar). */
export function preloadPart(id: BandPartId) {
  const a = audio();
  const part = BAND_PARTS.find((p) => p.id === id);
  if (!a || !part) return;
  if (part.bank === 'drums') ensureDrums(a.ctx);
  else ensureNotes(a.ctx, part.bank);
}

const BASS_SOUND: PluckSound = {
  sustain: 1.4, softness: 0.4, lowpassHz: 1100, strumMs: 0, pluckPosition: 0.22,
  body: [{ hz: 70, q: 1, db: 4 }],
  reverb: 0.04, pickNoise: 0,
};

/* ------------------------------------------------------------------ acordes */

type ChordInfo = { root: number; bass: number; fifth: number; third: number; seventh: number | null; notes: number[] };
const infoCache = new Map<string, ChordInfo | null>();

/** Notas úteis do acorde para baixo e sanfona (classes 0..11 e as notas do teclado). */
export function chordInfo(name: string): ChordInfo | null {
  if (infoCache.has(name)) return infoCache.get(name)!;
  const p = parseChord(name);
  let info: ChordInfo | null = null;
  if (p) {
    const all = [...p.required, ...p.optional];
    const fifth = all.find((i) => i === 7 || i === 6 || i === 8) ?? 7;
    const third = all.find((i) => i === 3 || i === 4) ?? (all.includes(5) ? 5 : all.includes(2) ? 2 : 4);
    const seventh = all.find((i) => i === 10 || i === 11 || i === 9) ?? null;
    const v = generateKeyboardVoicings(p)[0];
    info = { root: p.root, bass: p.bass, fifth, third, seventh, notes: v?.notes ?? [] };
  }
  infoCache.set(name, info);
  return info;
}

/** Nota na região grave: E1 (28) a D#2 (39), como no baixo de 4 cordas. */
const bassMidi = (pc: number) => 28 + ((pc - 4 + 12) % 12);

/* -------------------------------------------------------------------- baixo */

/**
 * Passos do baixo: R raiz (ou o baixo invertido), 5 quinta, 8 oitava, 3 terça, 7 sétima,
 * r raiz fraca, . pausa (a nota anterior continua).
 */
export function playBassStep(chord: string, step: string, when: number, level: number): boolean {
  const info = chordInfo(chord);
  if (!info || step === '.' || step === '-') return false;
  const root = bassMidi(info.bass);
  const fromRoot = bassMidi(info.root);
  let midi: number;
  switch (step) {
    case '5': midi = fromRoot + info.fifth; break;
    case '8': midi = root + 12; break;
    case '3': midi = fromRoot + info.third; break;
    case '7': midi = fromRoot + (info.seventh ?? 10); break;
    default: midi = root;
  }
  while (midi > 45) midi -= 12;
  const gain = (step === 'r' ? 0.65 : 1) * level;
  playPluckNote('bass', BASS_SOUND, midi, { when, gain, channel: 'baixo' }, 'baixo');
  return true;
}

/* ------------------------------------------------------------------- sanfona */

/** Uma palheta da sanfona: dois osciladores levemente desafinados, com o fole abrindo. */
function reed(c: AudioContext, dest: AudioNode, midi: number, t: number, gain: number, hold: number) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  g.gain.setTargetAtTime(gain * 0.85, t + 0.06, 0.2);
  g.connect(dest);
  const oscs = [-7, 7].map((cents, k) => {
    const o = c.createOscillator();
    o.type = k === 0 ? 'sawtooth' : 'square';
    o.frequency.value = f;
    o.detune.value = cents;
    const og = c.createGain();
    og.gain.value = k === 0 ? 0.6 : 0.25;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + hold);
    return o;
  });
  return oscs;
}

/**
 * Passos da sanfona: S acorde segurado (até o próximo toque), c acorde curto,
 * B baixo da mão esquerda, b baixo na quinta, - segura, . solta.
 */
export function playSanfonaStep(chord: string, step: string, when: number, level: number): boolean {
  const info = chordInfo(chord);
  const a = audio();
  if (!info || !a || step === '-') return false;
  const { ctx: c } = a;
  if (step === '.') {
    // Solta o acorde segurado.
    const v = openVoice(when, { reverb: 0, damp: true, channel: 'sanfona' });
    v?.gain.gain.setValueAtTime(0, when);
    return false;
  }
  const held = step === 'S';
  const short = step === 'c' || step === 'B' || step === 'b';
  const hold = held ? 8 : 0.3;
  ensureNotes(c, 'sanfona');
  const sampled = noteSample('sanfona', 60) != null;
  const voice = openVoice(when, sampled
    ? { reverb: 0.18, damp: true, channel: 'sanfona', pan: 0.2, lowpassHz: 7000 }
    : { reverb: 0.2, damp: true, channel: 'sanfona', pan: 0.2, lowpassHz: 2600, body: [{ hz: 900, q: 0.8, db: 3 }] });
  if (!voice) return false;
  // O fole abre devagar no acorde segurado; o curto é uma "puxada" seca.
  voice.gain.gain.setValueAtTime(held ? 0.0001 : 1, when);
  if (held) voice.gain.gain.setTargetAtTime(1, when, 0.025);
  if (short) voice.gain.gain.setTargetAtTime(0, when + 0.16, 0.04);
  const notes = step === 'B' ? [36 + ((info.bass - 0 + 12) % 12)]
    : step === 'b' ? [36 + ((info.root + info.fifth) % 12)]
      : info.notes;
  const per = (0.22 * level) / Math.sqrt(Math.max(3, notes.length));
  if (sampled) {
    const srcs = notes.flatMap((m) => {
      const smp = noteSample('sanfona', m);
      if (!smp) return [];
      const src = c.createBufferSource();
      src.buffer = smp.sample.buffer;
      src.playbackRate.value = smp.rate;
      const g = c.createGain();
      g.gain.value = per * 2.6 * smp.sample.gain * (step === 'B' || step === 'b' ? 1.3 : 1);
      src.connect(g).connect(voice.gain);
      src.start(when, smp.sample.offset);
      return [src];
    });
    voice.onDamp = (t) => srcs.forEach((s) => { try { s.stop(Math.max(t, c.currentTime) + 0.1); } catch { } });
    return true;
  }
  const oscs = notes.flatMap((m) => reed(c, voice.gain, m, when, step === 'B' || step === 'b' ? per * 1.6 : per, hold));
  voice.onDamp = (t) => oscs.forEach((o) => { try { o.stop(Math.max(t, c.currentTime) + 0.1); } catch { } });
  return true;
}

/* ------------------------------------------------------------------- bateria */

/** Peças da bateria (kit): bumbo, caixa, chimbal fechado e aberto, aro. */
export type DrumId = 'k' | 's' | 'h' | 'o' | 'r';

/** Onde cada peça fica no estéreo (como numa bateria vista da plateia). */
const DRUM_PAN: Record<DrumId, number> = { k: 0, s: 0.05, h: 0.3, o: 0.3, r: 0.05 };

type Hit = { s: Sample | null; gain: number; rate: number };

/** Gravação para a batida (e um ajuste de volume/afinação da peça). */
function drumFor(drum: DrumId, hit: string): Hit {
  const strong = hit === 'X';
  switch (drum) {
    case 'k': return { s: drumSample('kick', strong), gain: 1.15, rate: 1.12 };
    case 's': return { s: drumSample('snare', hit !== 'g' && strong), gain: hit === 'g' ? 0.45 : 0.85, rate: 1 };
    case 'h': return { s: drumSample('hat', strong), gain: 0.45, rate: 1 };
    case 'o': return { s: drumSample('hatopen', true), gain: 0.4, rate: 1 };
    case 'r': return { s: drumSample('stick', true), gain: 0.6, rate: 1 };
  }
}

let shakerFlip = false;
/**
 * Gravações de cada toque da percussão (um toque pode juntar duas, como no pandeiro: pele + platinelas).
 * Letras: X forte, x normal, g fantasma/abafado; no rebolo O/o aberto e m abafado; no pandeiro
 * G grave aberto, g grave abafado (polegar), p platinela leve, P platinela forte (tapa).
 */
function percFor(perc: PercId, hit: string): Hit[] {
  const strong = hit === 'X' || hit === 'O' || hit === 'G' || hit === 'P';
  switch (perc) {
    case 'surdo': return hit === 'g' || hit === 'm'
      ? [{ s: drumSample('surdomute', strong), gain: 0.8, rate: 0.82 }]
      : [{ s: drumSample('surdo', strong), gain: strong ? 1.1 : 0.85, rate: 0.82 }];
    case 'rebolo': return hit === 'm' || hit === 'g'
      ? [{ s: drumSample('rebolomute', true), gain: 0.7, rate: 0.82 }]
      : [{ s: drumSample('rebolo', strong), gain: strong ? 1 : 0.75, rate: 0.8 }];
    case 'pandeiro': switch (hit) {
      case 'G': return [{ s: drumSample('pandeirograve', true), gain: 0.85, rate: 0.95 }, { s: drumSample('platinela', false), gain: 0.35, rate: 1 }];
      case 'g': return [{ s: drumSample('pandeiromute', true), gain: 0.6, rate: 0.95 }, { s: drumSample('platinela', false), gain: 0.3, rate: 1 }];
      case 'P': return [{ s: drumSample('platinela', true), gain: 0.75, rate: 1 }, { s: drumSample('pandeiromute', false), gain: 0.35, rate: 1.1 }];
      default: return [{ s: drumSample('platinela', false), gain: 0.4, rate: 1.03 }];
    }
    case 'tamborim': return [{ s: drumSample('tamborim', strong), gain: hit === 'g' ? 0.4 : strong ? 0.9 : 0.7, rate: 1.35 }];
    case 'ganza': {
      shakerFlip = !shakerFlip;
      return [{ s: drumSample(shakerFlip ? 'shaker_down' : 'shaker_up', true), gain: strong ? 0.55 : 0.4, rate: 1 }];
    }
    case 'triangulo': return [{ s: drumSample(strong ? 'triangle_open' : 'triangle_mute', true), gain: hit === 'g' ? 0.25 : 0.4, rate: 1 }];
    case 'zabumba': return hit === 'g'
      ? [{ s: drumSample('zabumbamute', true), gain: 0.9, rate: 1 }]
      : [{ s: drumSample('zabumba', strong), gain: strong ? 1.1 : 0.85, rate: 1 }];
  }
}

const PERC_PAN: Record<PercId, number> = Object.fromEntries(
  BAND_PARTS.filter((p) => p.role === 'perc').map((p) => [p.id, p.pan]),
) as Record<PercId, number>;

let drumNoise: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (!drumNoise) {
    drumNoise = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
    const d = drumNoise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return drumNoise;
}

let drumBus: GainNode | null = null;
/** Bateria e percussão: um pouco de "sala" (reverb) e um compressor leve para soarem juntas. */
function bus(c: AudioContext, out: AudioNode, reverb: AudioNode): GainNode {
  if (!drumBus) {
    drumBus = c.createGain();
    drumBus.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.12;
    const send = c.createGain();
    send.gain.value = 0.14;
    drumBus.connect(comp).connect(out);
    comp.connect(send).connect(reverb);
  }
  return drumBus;
}

function noiseHit(c: AudioContext, dest: AudioNode, t: number, type: BiquadFilterType, hz: number, q: number, gain: number, decay: number) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(dest);
  src.start(t);
  src.stop(t + decay + 0.02);
}

function toneHit(c: AudioContext, dest: AudioNode, t: number, type: OscillatorType, from: number, to: number, sweep: number, gain: number, decay: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + sweep);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + decay + 0.02);
}

/** Toca as gravações de uma batida, com a força de cada uma variando um pouco (mão humana). */
function playHits(c: AudioContext, dest: AudioNode, hits: Hit[], t: number, v: number): boolean {
  let any = false;
  for (const h of hits) {
    if (!h.s) continue;
    const src = c.createBufferSource();
    src.buffer = h.s.buffer;
    src.playbackRate.value = h.rate * (1 + (Math.random() - 0.5) * 0.012);
    const g = c.createGain();
    g.gain.value = h.s.gain * h.gain * v * (0.92 + Math.random() * 0.08);
    src.connect(g).connect(dest);
    src.start(t, h.s.offset);
    any = true;
  }
  return any;
}

const hitLevel = (hit: string) => (hit === 'X' || hit === 'O' || hit === 'G' || hit === 'P' ? 1 : hit === 'g' ? 0.3 : 0.7);

function outFor(c: AudioContext, pan: number, out: AudioNode, reverb: AudioNode): AudioNode {
  const p = c.createStereoPanner();
  p.pan.value = pan;
  p.connect(bus(c, out, reverb));
  return p;
}

/** Uma batida da bateria. `hit`: X forte, x normal, g fantasma (bem fraca). */
export function playDrum(drum: DrumId, hit: string, when: number, level: number) {
  const a = audio();
  if (!a || hit === '.' || !hit) return;
  const { ctx: c } = a;
  const v = hitLevel(hit) * level;
  const t = Math.max(when, c.currentTime + 0.005);
  ensureDrums(c);
  const dest = outFor(c, DRUM_PAN[drum], a.out, a.reverbIn);

  if (playHits(c, dest, [drumFor(drum, hit)], t, v)) {
    // Bumbo: o "tum" da gravação é de bumbo grande; um estalo curto dá a pegada de bateria.
    if (drum === 'k') noiseHit(c, dest, t, 'bandpass', 3200, 1.2, 0.08 * v, 0.012);
    return;
  }
  // Ainda carregando: versão sintetizada.
  switch (drum) {
    case 'k':
      toneHit(c, dest, t, 'sine', 140, 45, 0.09, 1.1 * v, 0.38);
      noiseHit(c, dest, t, 'lowpass', 3000, 0.7, 0.12 * v, 0.012);
      break;
    case 's':
      noiseHit(c, dest, t, 'highpass', 1400, 0.7, 0.55 * v, 0.17);
      toneHit(c, dest, t, 'triangle', 240, 170, 0.05, 0.45 * v, 0.1);
      break;
    case 'h': noiseHit(c, dest, t, 'highpass', 7500, 0.8, 0.22 * v, 0.045); break;
    case 'o': noiseHit(c, dest, t, 'highpass', 7000, 0.8, 0.2 * v, 0.32); break;
    case 'r':
      toneHit(c, dest, t, 'square', 1700, 1500, 0.01, 0.12 * v, 0.03);
      noiseHit(c, dest, t, 'bandpass', 2400, 2, 0.25 * v, 0.03);
      break;
  }
}

/** Uma batida de percussão (surdo, rebolo, pandeiro...). Ver `percFor` para as letras. */
export function playPerc(perc: PercId, hit: string, when: number, level: number) {
  const a = audio();
  if (!a || hit === '.' || hit === '-' || !hit) return;
  const { ctx: c } = a;
  ensureDrums(c);
  const t = Math.max(when, c.currentTime + 0.005);
  playHits(c, outFor(c, PERC_PAN[perc], a.out, a.reverbIn), percFor(perc, hit), t, hitLevel(hit) * level);
}

/** Toque de acorde de um instrumento da banda (violão, guitarra, teclado...) no seu canal. */
export const chordStrokeFor = (part: BandPart, opts: StrokeOptions): StrokeOptions => ({
  ...opts,
  channel: part.id,
  pan: part.pan,
  gain: (opts.gain ?? 1) * part.level,
});
