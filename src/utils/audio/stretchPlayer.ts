/**
 * Player do playback com troca de tom e de velocidade independentes, em tempo real
 * (Signalsmith Stretch: WASM num AudioWorklet, licença MIT).
 *
 * - O tempo da música (para a sincronia) é calculado pelo relógio do Web Audio a partir do que foi
 *   agendado (início, posição, velocidade e o atraso fixo do stretch): exato, sem depender do worklet.
 * - Faixas separadas/importadas (voz, bateria, baixo...): tocam juntas em fontes nativas do Web Audio,
 *   cada uma com seu volume, e são somadas ANTES do stretch (um stretch estéreo só, qualquer que seja o
 *   número de faixas). Ligar, desligar, solar e mudar o volume é instantâneo.
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
  /** Atraso da saída em relação à entrada, em segundos (modo entrada ao vivo). */
  latency?: () => number | Promise<number>;
  configure?: (o: Record<string, number | boolean | string>) => unknown;
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

/** Quanto à frente agendar as mudanças (dá tempo de todos os nós receberem o mesmo instante). */
const LEAD_S = 0.06;
/** Fade curto para pausar/pular sem estalo. */
const FADE_S = 0.015;

/** Uma faixa carregada: o áudio decodificado e o volume dela (antes da soma). */
type Track = { buffer: AudioBuffer; gain: GainNode };

/** Trecho da linha do tempo de saída: a partir de `out` (relógio do áudio), a música está em `input` e anda a `rate`. */
type OutAnchor = { out: number; input: number; rate: number };

/**
 * Faixas (1 = o áudio original; várias = faixas separadas/importadas) tocam em AudioBufferSourceNodes
 * nativos, todas com o mesmo `start` e o mesmo `playbackRate` (sincronia exata). Cada faixa passa pelo
 * próprio volume, são SOMADAS e só a soma estéreo entra no stretch, em modo "entrada ao vivo". Assim o
 * custo do stretch não cresce com o número de faixas (medido: 8 faixas = ~5% de um núcleo, contra ~45%
 * com uma passada do stretch por faixa).
 *
 * Velocidade: muda o `playbackRate` das fontes (o que também muda o tom) e o stretch corrige o tom em
 * -12·log2(velocidade) semitons, mais a transposição pedida. O stretch atrasa a saída em `latency`
 * segundos (fixo, ~0,12 s): o relógio da música (`currentTime`) já desconta isso.
 */
class StretchEngine implements PlaybackEngine {
  readonly canShiftPitch = true;
  readonly canMultitrack = true;
  duration = 0;
  playing = false;
  private rate = 1;
  private semitones = 0;
  private pos = 0; // posição quando pausado
  private tracks: Track[] = [];
  private trackGains: number[] = [1];
  private sources: AudioBufferSourceNode[] = [];
  /** Relógio das fontes: no instante `t` (relógio do áudio), elas estavam em `input`. */
  private src = { t: 0, input: 0 };
  /** Linha do tempo do que sai no alto-falante (as últimas mudanças de velocidade). */
  private outs: OutAnchor[] = [];
  private loadToken = 0;
  private endTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(
    private ctx: AudioContext,
    private node: StretchNode,
    /** Soma das faixas (estéreo) -> stretch. */
    private sum: GainNode,
    /** Silencia a saída nas emendas (pausa, pulo) para não tocar o que ficou no stretch. */
    private duck: GainNode,
    private master: GainNode,
    private latency: number,
    private ev: PlayerEvents,
  ) {}

  static async create(ev: PlayerEvents): Promise<StretchEngine> {
    if (typeof AudioWorkletNode === 'undefined') throw new Error('sem AudioWorklet');
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ STRETCH_URL)) as { default: StretchFactory };
    const ctx = new AudioContext({ latencyHint: 'playback' });
    try {
      const node = (await withTimeout(mod.default(ctx, {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      }), CREATE_TIMEOUT_MS)) as unknown as StretchNode;
      // espalha o cálculo pelo tempo (sem picos num bloco de áudio só, que é o que causa estalo)
      await node.configure?.({ blockMs: 120, intervalMs: 30, splitComputation: true });
      const sum = ctx.createGain();
      sum.channelCount = 2;
      sum.channelCountMode = 'explicit';
      const duck = ctx.createGain();
      duck.gain.value = 0;
      const master = ctx.createGain();
      sum.connect(node);
      node.connect(duck);
      duck.connect(master);
      master.connect(ctx.destination);
      const latency = Number(await withTimeout(Promise.resolve(node.latency?.() ?? 0.12), CREATE_TIMEOUT_MS)) || 0.12;
      return new StretchEngine(ctx, node, sum, duck, master, latency, ev);
    } catch (e) {
      ctx.close().catch(() => undefined);
      throw e;
    }
  }

  get trackCount() { return this.tracks.length; }

  /** Correção de tom do stretch: desfaz a mudança de tom da velocidade e aplica a transposição. */
  private correction(rate = this.rate) {
    return this.semitones - 12 * Math.log2(rate);
  }

  /** Onde as fontes estão (ou estarão) no instante `t` do relógio do áudio. */
  private srcPos(t: number) {
    return this.src.input + (t - this.src.t) * this.rate;
  }

  private startSources(at: number, input: number) {
    this.sources = this.tracks.map((tr) => {
      const s = this.ctx.createBufferSource();
      s.buffer = tr.buffer;
      s.playbackRate.value = this.rate;
      s.connect(tr.gain);
      if (input < tr.buffer.duration) s.start(at, Math.max(0, input));
      s.onended = () => { try { s.disconnect(); } catch { /* já desligado */ } };
      return s;
    });
    this.src = { t: at, input };
  }

  private stopSources(at: number) {
    for (const s of this.sources) {
      try { s.stop(at); } catch { /* não tinha começado */ }
    }
    this.sources = [];
  }

  /** Saída em silêncio de agora até `from`, e volta (rápido) a partir dele. */
  private duckUntil(from: number) {
    const g = this.duck.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + FADE_S);
    g.setValueAtTime(0, Math.max(t + FADE_S, from));
    g.linearRampToValueAtTime(1, Math.max(t + FADE_S, from) + FADE_S);
  }

  private fadeOut() {
    const g = this.duck.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + FADE_S);
  }

  private async decode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
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
    const buffers = await Promise.all(urls.map((u) => this.decode(u)));
    if (token !== this.loadToken) return; // trocou de faixa no meio

    const gains = Array.from({ length: urls.length }, (_, i) => opts?.gains?.[i] ?? 1);
    const next: Track[] = buffers.map((buffer, i) => {
      const gain = this.ctx.createGain();
      gain.gain.value = gains[i];
      gain.connect(this.sum);
      return { buffer, gain };
    });
    const old = this.tracks;
    this.tracks = next;
    this.trackGains = gains;
    this.duration = Math.max(...buffers.map((b) => b.duration));
    if (opts?.masterGain != null) this.setMasterGain(opts.masterGain);

    if (keep && this.playing) {
      // troca na hora, no mesmo ponto da música: o stretch recebe o som sem emenda
      const at = this.ctx.currentTime + LEAD_S;
      const input = Math.min(this.srcPos(at), this.duration);
      this.stopSources(at);
      this.startSources(at, input);
    } else if (keep) {
      this.pos = Math.min(this.pos, this.duration);
    }
    // o volume das faixas antigas sai depois que elas param
    setTimeout(() => old.forEach((tr) => { try { tr.gain.disconnect(); } catch { /* já desligado */ } }), 500);
  }

  setTrackGains(gains: number[]) {
    this.trackGains = gains.slice();
    const t = this.ctx.currentTime;
    this.tracks.forEach((tr, i) => {
      const v = gains[i] ?? 1;
      tr.gain.gain.cancelScheduledValues(t);
      tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
      tr.gain.gain.linearRampToValueAtTime(v, t + GAIN_RAMP_S);
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
    let a = this.outs[0];
    if (!a) return this.pos;
    for (const x of this.outs) if (x.out <= t) a = x;
    if (t <= a.out) return a.input;
    return Math.min(this.duration, a.input + (t - a.out) * a.rate);
  }

  /** Começa (ou recomeça, ao pular) a tocar de `input`: fontes novas, saída em silêncio até elas chegarem. */
  private startAt(input: number) {
    const at = this.ctx.currentTime + LEAD_S;
    const heard = at + this.latency;
    this.stopSources(at);
    this.node.schedule({ active: true, semitones: this.correction(), output: at });
    this.startSources(at, input);
    this.duckUntil(heard);
    this.outs = [{ out: heard, input, rate: this.rate }];
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
    this.fadeOut();
    const end = this.ctx.currentTime + FADE_S;
    this.stopSources(end);
    this.node.schedule({ active: false, output: end + 0.005 });
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
    if (!this.playing) {
      this.rate = r;
      return;
    }
    // muda a velocidade das fontes num instante e, quando esse som sair do stretch, corrige o tom
    const at = this.ctx.currentTime + LEAD_S;
    const input = this.srcPos(at);
    for (const s of this.sources) s.playbackRate.setValueAtTime(r, at);
    this.rate = r;
    this.src = { t: at, input };
    this.node.schedule({ active: true, semitones: this.correction(r), output: at + this.latency });
    this.outs = [...this.outs.slice(-2), { out: at + this.latency, input, rate: r }];
  }

  setSemitones(s: number) {
    if (s === this.semitones) return;
    this.semitones = s;
    // muda só o tom; posição e velocidade seguem
    this.node.schedule({ semitones: this.correction(), output: this.ctx.currentTime });
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
    this.stopSources(this.ctx.currentTime);
    try {
      this.node.schedule({ active: false, output: this.ctx.currentTime });
      this.node.disconnect();
      this.sum.disconnect();
      this.duck.disconnect();
      this.master.disconnect();
      this.tracks.forEach((tr) => tr.gain.disconnect());
    } catch { /* já desligado */ }
    this.tracks = [];
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
