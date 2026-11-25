/**
 * Player do playback com troca de tom e de velocidade independentes, em tempo real
 * (Signalsmith Stretch: WASM num AudioWorklet, licença MIT).
 *
 * - O tempo da música (para a sincronia) é calculado pelo relógio do Web Audio a partir do que foi
 *   agendado (início, posição e velocidade): exato, sem depender das mensagens do worklet.
 * - Faixas separadas (voz, bateria, baixo...): todas vão para UM nó de stretch com 2 canais por
 *   faixa, então posição, velocidade e tom são os mesmos para todas (sem defasagem entre elas).
 *   Depois do stretch, cada canal tem um ganho: ligar, desligar e solar é instantâneo.
 * - Sem AudioWorklet (navegador antigo) ou se a biblioteca falhar, cai para o <audio> comum:
 *   velocidade funciona, troca de tom e faixas separadas não (`canShiftPitch`/`canMultitrack` = false).
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
  /** O último argumento opcional é a lista de transferência do postMessage (evita copiar o áudio). */
  addBuffers: (bufs: Float32Array[], transfer?: Transferable[]) => Promise<number>;
  dropBuffers: () => Promise<unknown>;
};

/** Rampa dos ganhos das faixas (liga/desliga sem estalo). */
const GAIN_RAMP_S = 0.03;

export type PlayerEvents = {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
};

export type LoadOptions = {
  /** Mantém a posição (e continua tocando, se estava): troca entre original e faixas separadas. */
  keepPosition?: boolean;
  /** Volume inicial de cada faixa (aplicado junto com a troca). */
  gains?: number[];
  /** Volume geral aplicado junto com a troca. */
  masterGain?: number;
};

export interface PlaybackEngine {
  readonly canShiftPitch: boolean;
  /** Toca várias faixas juntas (faixas separadas), cada uma com seu volume. */
  readonly canMultitrack: boolean;
  readonly duration: number;
  readonly playing: boolean;
  /** Quantas faixas estão carregadas (1 = um arquivo só, o áudio original). */
  readonly trackCount: number;
  /** Carrega um arquivo ou várias faixas de mesma duração, tocadas em sincronia exata. */
  load(url: string | string[], opts?: LoadOptions): Promise<void>;
  /** Volume de cada faixa (0..1); muda na hora, durante a reprodução. */
  setTrackGains(gains: number[]): void;
  /** Volume geral (ex.: compensar a folga com que as faixas separadas foram gravadas). */
  setMasterGain(g: number): void;
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

/** Faixas carregadas num nó de stretch: 2 canais por faixa, cada canal com seu ganho. */
type Graph = {
  node: StretchNode;
  splitter: ChannelSplitterNode;
  gains: GainNode[];
  merger: ChannelMergerNode;
  tracks: number;
};

class StretchEngine implements PlaybackEngine {
  readonly canShiftPitch = true;
  readonly canMultitrack = true;
  duration = 0;
  playing = false;
  private rate = 1;
  private semitones = 0;
  private pos = 0; // posição quando pausado
  private anchor = { out: 0, input: 0 }; // tocando: na hora `out` (relógio do áudio), a música estava em `input`
  private loadToken = 0;
  private endTimer: ReturnType<typeof setInterval> | null = null;
  private graph: Graph | null = null;
  private trackGains: number[] = [1];

  private constructor(
    private ctx: AudioContext,
    private factory: StretchFactory,
    private master: GainNode,
    private ev: PlayerEvents,
  ) {}

  static async create(ev: PlayerEvents): Promise<StretchEngine> {
    if (typeof AudioWorkletNode === 'undefined') throw new Error('sem AudioWorklet');
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ STRETCH_URL)) as { default: StretchFactory };
    const ctx = new AudioContext({ latencyHint: 'playback' });
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const engine = new StretchEngine(ctx, mod.default, master, ev);
    try {
      // já monta o nó estéreo (e descobre se o worklet funciona neste navegador)
      engine.graph = await withTimeout(engine.buildGraph(1), CREATE_TIMEOUT_MS);
    } catch (e) {
      ctx.close().catch(() => undefined);
      throw e;
    }
    return engine;
  }

  get trackCount() { return this.graph?.tracks ?? 0; }

  private async buildGraph(tracks: number): Promise<Graph> {
    const ch = 2 * tracks;
    const node = (await this.factory(this.ctx, {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [ch],
    })) as unknown as StretchNode;
    const splitter = this.ctx.createChannelSplitter(ch);
    const merger = this.ctx.createChannelMerger(2);
    node.connect(splitter);
    const gains = Array.from({ length: ch }, (_, c) => {
      const g = this.ctx.createGain();
      g.gain.value = this.trackGains[c >> 1] ?? 1;
      splitter.connect(g, c);
      g.connect(merger, 0, c & 1); // canais pares → esquerda, ímpares → direita (somados)
      return g;
    });
    merger.connect(this.master);
    return { node, splitter, gains, merger, tracks };
  }

  private disposeGraph(g: Graph, afterS = 0) {
    try { g.node.schedule({ active: false, output: this.ctx.currentTime + afterS }); } catch { /* já desligado */ }
    const free = () => {
      try {
        g.node.dropBuffers().catch(() => undefined);
        g.node.disconnect();
        g.splitter.disconnect();
        g.merger.disconnect();
        g.gains.forEach((x) => x.disconnect());
      } catch { /* já desligado */ }
    };
    if (afterS > 0) setTimeout(free, afterS * 1000 + 250); else free();
  }

  private async decode(url: string): Promise<Float32Array[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const audio = await this.ctx.decodeAudioData(await res.arrayBuffer());
    // cópia própria: é transferida para o worklet (sem duplicar) e o AudioBuffer pode ser liberado
    const l = audio.getChannelData(0).slice();
    const r = audio.numberOfChannels > 1 ? audio.getChannelData(1).slice() : l.slice();
    return [l, r];
  }

  async load(src: string | string[], opts?: LoadOptions) {
    const urls = Array.isArray(src) ? src : [src];
    const keep = !!opts?.keepPosition;
    const token = ++this.loadToken;
    if (!keep) {
      this.pause();
      this.pos = 0;
      this.duration = 0;
    }
    // Enquanto baixa e decodifica, o áudio atual continua tocando (keepPosition).
    const decoded = await Promise.all(urls.map((u) => this.decode(u)));
    if (token !== this.loadToken) return; // trocou de faixa no meio
    const len = Math.max(...decoded.map((d) => d[0].length));
    const chans: Float32Array[] = [];
    for (const d of decoded) {
      for (const c of d) {
        if (c.length === len) chans.push(c);
        else { const p = new Float32Array(len); p.set(c); chans.push(p); }
      }
    }

    // Mesmo número de faixas e parado: reaproveita o nó. Senão, monta outro e troca na hora.
    const old = this.graph;
    const reuse = !!old && old.tracks === urls.length && !(keep && this.playing);
    const g = reuse && old ? old : await this.buildGraph(urls.length);
    if (token !== this.loadToken) { if (g !== old) this.disposeGraph(g); return; }
    if (reuse) await g.node.dropBuffers();
    await g.node.addBuffers(chans, chans.map((c) => c.buffer));
    if (token !== this.loadToken) { if (g !== old) this.disposeGraph(g); return; }

    const at = keep ? this.currentTime() : 0;
    const gains = Array.from({ length: urls.length }, (_, i) => opts?.gains?.[i] ?? 1);
    this.trackGains = gains;
    g.gains.forEach((x, c) => { x.gain.value = gains[c >> 1]; });
    if (opts?.masterGain != null) this.setMasterGain(opts.masterGain);
    this.graph = g;
    this.duration = len / this.ctx.sampleRate;
    if (keep) {
      this.pos = Math.min(at, this.duration);
      if (this.playing) this.startAt(this.pos);
    }
    // o antigo para no mesmo instante em que o novo entra (sem buraco nem eco)
    if (old && g !== old) this.disposeGraph(old, this.playing ? LEAD_S : 0);
  }

  setTrackGains(gains: number[]) {
    this.trackGains = gains.slice();
    const g = this.graph;
    if (!g) return;
    const t = this.ctx.currentTime;
    g.gains.forEach((x, c) => {
      const v = gains[c >> 1] ?? 1;
      x.gain.cancelScheduledValues(t);
      x.gain.setValueAtTime(x.gain.value, t);
      x.gain.linearRampToValueAtTime(v, t + GAIN_RAMP_S);
    });
  }

  setMasterGain(v: number) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(v, t + GAIN_RAMP_S);
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
    this.graph?.node.schedule({ active: true, input, rate: this.rate, semitones: this.semitones, output: out });
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
    this.graph?.node.schedule({ active: false, output: this.ctx.currentTime });
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
    this.graph?.node.schedule({ semitones: s, output: this.ctx.currentTime });
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
    if (this.graph) this.disposeGraph(this.graph);
    try { this.master.disconnect(); } catch { /* já desligado */ }
    this.ctx.close().catch(() => undefined);
  }
}

/** Reserva: <audio> comum (velocidade sem mudar o tom; sem troca de tom nem faixas separadas). */
class MediaEngine implements PlaybackEngine {
  readonly canShiftPitch = false;
  readonly canMultitrack = false;
  readonly trackCount = 1;
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
  load(src: string | string[], opts?: LoadOptions) {
    const url = Array.isArray(src) ? src[0] : src;
    if (opts?.masterGain != null) this.setMasterGain(opts.masterGain);
    return new Promise<void>((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('load')); };
      const cleanup = () => { this.a.removeEventListener('loadedmetadata', ok); this.a.removeEventListener('error', fail); };
      this.a.addEventListener('loadedmetadata', ok);
      this.a.addEventListener('error', fail);
      this.a.src = url;
    });
  }
  setTrackGains() { /* sem suporte */ }
  setMasterGain(g: number) { this.a.volume = Math.max(0, Math.min(1, g)); }
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
