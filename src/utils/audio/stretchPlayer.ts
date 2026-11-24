/**
 * Player do playback com troca de tom e de velocidade independentes, em tempo real
 * (Signalsmith Stretch: WASM num AudioWorklet, licença MIT).
 *
 * - O tempo da música (para a sincronia) é calculado pelo relógio do Web Audio a partir do que foi
 *   agendado (início, posição e velocidade): exato, sem depender das mensagens do worklet.
 * - Sem AudioWorklet (navegador antigo) ou se a biblioteca falhar, cai para o <audio> comum:
 *   velocidade funciona, troca de tom não (`canShiftPitch` = false).
 * - Baixar o arquivo com fetch exige CORS liberado no bucket do Storage (ver cors.json).
 * - A biblioteca é servida de /vendor SEM passar pelo bundler (scripts/copy-vendor.mjs): ela monta o
 *   AudioWorklet a partir do texto do próprio código, e o bundler injetaria polyfills que quebram o worklet.
 */

const STRETCH_URL = '/vendor/signalsmith-stretch.js';
/** Se o worklet não ficar pronto nesse tempo, usa o <audio> comum. */
const CREATE_TIMEOUT_MS = 8000;

type StretchFactory = (ctx: BaseAudioContext, options?: AudioWorkletNodeOptions) => Promise<AudioWorkletNode>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

type StretchNode = AudioNode & {
  schedule: (o: Record<string, number | boolean>) => void;
  addBuffers: (bufs: Float32Array[]) => Promise<number>;
  dropBuffers: () => Promise<unknown>;
};

export type PlayerEvents = {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
};

export interface PlaybackEngine {
  readonly canShiftPitch: boolean;
  readonly duration: number;
  readonly playing: boolean;
  load(url: string): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
  currentTime(): number;
  setRate(r: number): void;
  setSemitones(s: number): void;
  destroy(): void;
}

/** Quanto à frente agendar as mudanças (dá tempo do stretch compensar a própria latência). */
const LEAD_S = 0.06;

class StretchEngine implements PlaybackEngine {
  readonly canShiftPitch = true;
  duration = 0;
  playing = false;
  private rate = 1;
  private semitones = 0;
  private pos = 0; // posição quando pausado
  private anchor = { out: 0, input: 0 }; // tocando: na hora `out` (relógio do áudio), a música estava em `input`
  private loadToken = 0;
  private endTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(private ctx: AudioContext, private node: StretchNode, private gain: GainNode, private ev: PlayerEvents) {}

  static async create(ev: PlayerEvents): Promise<StretchEngine> {
    if (typeof AudioWorkletNode === 'undefined') throw new Error('sem AudioWorklet');
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ STRETCH_URL)) as { default: StretchFactory };
    const ctx = new AudioContext({ latencyHint: 'playback' });
    let node: StretchNode;
    try {
      node = (await withTimeout(mod.default(ctx), CREATE_TIMEOUT_MS)) as unknown as StretchNode;
    } catch (e) {
      ctx.close().catch(() => undefined);
      throw e;
    }
    const gain = ctx.createGain();
    node.connect(gain).connect(ctx.destination);
    return new StretchEngine(ctx, node, gain, ev);
  }

  async load(url: string) {
    const token = ++this.loadToken;
    this.pause();
    this.pos = 0;
    this.duration = 0;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const audio = await this.ctx.decodeAudioData(await res.arrayBuffer());
    if (token !== this.loadToken) return; // trocou de faixa no meio
    await this.node.dropBuffers();
    const chans = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, c) => audio.getChannelData(c));
    if (chans.length === 1) chans.push(chans[0]);
    await this.node.addBuffers(chans);
    this.duration = audio.duration;
  }

  private outNow() {
    // o que sai no alto-falante agora (desconta a latência da saída de áudio)
    const lat = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - lat;
  }

  currentTime() {
    if (!this.playing) return this.pos;
    const t = this.outNow();
    if (t <= this.anchor.out) return this.anchor.input;
    return Math.min(this.duration, this.anchor.input + (t - this.anchor.out) * this.rate);
  }

  private startAt(input: number) {
    const out = this.ctx.currentTime + LEAD_S;
    this.node.schedule({ active: true, input, rate: this.rate, semitones: this.semitones, output: out });
    this.anchor = { out, input };
  }

  async play() {
    if (this.playing || !this.duration) return;
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.pos >= this.duration - 0.05) this.pos = 0;
    this.playing = true;
    this.startAt(this.pos);
    this.watchEnd();
    this.ev.onPlay?.();
  }

  pause() {
    if (!this.playing) return;
    this.pos = this.currentTime();
    this.playing = false;
    this.node.schedule({ active: false, output: this.ctx.currentTime });
    if (this.endTimer) clearInterval(this.endTimer);
    this.endTimer = null;
    this.ev.onPause?.();
  }

  seek(t: number) {
    this.pos = Math.max(0, Math.min(t, this.duration));
    if (this.playing) this.startAt(this.pos);
  }

  setRate(r: number) {
    if (r === this.rate) return;
    if (this.playing) {
      const at = this.currentTime();
      this.rate = r;
      this.startAt(at);
    } else {
      this.rate = r;
    }
  }

  setSemitones(s: number) {
    if (s === this.semitones) return;
    this.semitones = s;
    // muda só o tom; posição e velocidade seguem (a âncora continua valendo)
    this.node.schedule({ semitones: s, output: this.ctx.currentTime });
  }

  private watchEnd() {
    if (this.endTimer) clearInterval(this.endTimer);
    this.endTimer = setInterval(() => {
      if (this.playing && this.currentTime() >= this.duration - 0.02) {
        this.pause();
        this.pos = this.duration;
        this.ev.onEnded?.();
      }
    }, 100);
  }

  destroy() {
    this.loadToken++;
    if (this.endTimer) clearInterval(this.endTimer);
    try { this.node.disconnect(); this.gain.disconnect(); } catch { /* já desligado */ }
    this.ctx.close().catch(() => undefined);
  }
}

/** Reserva: <audio> comum (velocidade sem mudar o tom; sem troca de tom). */
class MediaEngine implements PlaybackEngine {
  readonly canShiftPitch = false;
  private a = new Audio();
  constructor(ev: PlayerEvents) {
    this.a.preload = 'auto';
    this.a.addEventListener('play', () => ev.onPlay?.());
    this.a.addEventListener('pause', () => ev.onPause?.());
    this.a.addEventListener('ended', () => ev.onEnded?.());
    this.a.addEventListener('error', () => ev.onError?.('Não foi possível carregar o áudio.'));
  }
  get duration() { return Number.isFinite(this.a.duration) ? this.a.duration : 0; }
  get playing() { return !this.a.paused; }
  load(url: string) {
    return new Promise<void>((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('load')); };
      const cleanup = () => { this.a.removeEventListener('loadedmetadata', ok); this.a.removeEventListener('error', fail); };
      this.a.addEventListener('loadedmetadata', ok);
      this.a.addEventListener('error', fail);
      this.a.src = url;
    });
  }
  async play() { await this.a.play(); }
  pause() { this.a.pause(); }
  seek(t: number) { this.a.currentTime = Math.max(0, t); }
  currentTime() { return this.a.currentTime; }
  setRate(r: number) { this.a.playbackRate = r; }
  setSemitones() { /* sem suporte */ }
  destroy() { this.a.pause(); this.a.removeAttribute('src'); this.a.load(); }
}

/** Cria o player com troca de tom; se não der, o <audio> comum. */
export async function createPlaybackEngine(ev: PlayerEvents): Promise<PlaybackEngine> {
  try {
    return await StretchEngine.create(ev);
  } catch {
    return new MediaEngine(ev);
  }
}

/** O <audio> comum (sem troca de tom), para quando o player com troca de tom não consegue carregar. */
export function createMediaEngine(ev: PlayerEvents): PlaybackEngine {
  return new MediaEngine(ev);
}
