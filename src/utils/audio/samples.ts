/**
 * Sons gravados de instrumentos de verdade (em /public/samples), carregados só quando são usados.
 *
 * - Notas: uma gravação por semitom (FluidR3_GM, CC BY 3.0, via gleitz/midi-js-soundfonts).
 *   Fora da faixa gravada, a nota mais próxima é afinada (playbackRate).
 * - Bateria e percussão: batidas do VCSL (Versilian Community Sample Library, CC0), em
 *   duas intensidades e com variações para não soar "metralhadora".
 *
 * Enquanto um instrumento não terminou de carregar, quem toca usa o som sintetizado.
 */

export type NoteBankId = 'violao' | 'aco' | 'guitarra' | 'baixo' | 'piano' | 'sanfona';

const NOTE_BANKS: Record<NoteBankId, { lo: number; hi: number }> = {
  violao: { lo: 40, hi: 79 },   // violão de nylon
  aco: { lo: 55, hi: 88 },      // violão de aço (cavaquinho)
  guitarra: { lo: 40, hi: 79 }, // guitarra limpa
  baixo: { lo: 28, hi: 55 },    // baixo de dedo
  piano: { lo: 36, hi: 84 },
  sanfona: { lo: 36, hi: 84 },
};

export type DrumSampleId =
  | 'kick' | 'snare' | 'stick' | 'hat' | 'hatopen' | 'zabumba' | 'zabumbamute'
  | 'triangle_mute' | 'triangle_open' | 'pandeiro' | 'shaker_down' | 'shaker_up'
  | 'rebolo' | 'rebolomute' | 'tamborim' | 'pandeirograve' | 'pandeiromute' | 'platinela' | 'surdo' | 'surdomute';

/** Arquivos de cada peça: [fracos, fortes]. */
const DRUM_FILES: Record<DrumSampleId, [string[], string[]]> = {
  kick: [['kick_v3_1', 'kick_v3_2'], ['kick_v5_1', 'kick_v5_2']],
  snare: [['snare_v3_1', 'snare_v3_2'], ['snare_v6_1', 'snare_v6_2']],
  stick: [['stick_1', 'stick_2'], ['stick_1', 'stick_2']],
  hat: [['hat_v2_1', 'hat_v2_2'], ['hat_v4_1', 'hat_v4_2']],
  hatopen: [['hatopen_1'], ['hatopen_1']],
  zabumba: [['zabumba_2'], ['zabumba_1']],
  zabumbamute: [['zabumbamute_1'], ['zabumbamute_1']],
  triangle_mute: [['triangle_mute_1', 'triangle_mute_2'], ['triangle_mute_1', 'triangle_mute_2']],
  triangle_open: [['triangle_open_1'], ['triangle_open_1']],
  pandeiro: [['pandeiro_v1'], ['pandeiro_v2']],
  shaker_down: [['shaker_down_1', 'shaker_down_2'], ['shaker_down_1', 'shaker_down_2']],
  shaker_up: [['shaker_up_1', 'shaker_up_2'], ['shaker_up_1', 'shaker_up_2']],
  // Rebolo/tantã: tumba (a conga mais grave), afinada mais grave na hora de tocar.
  rebolo: [['rebolo_v2_1', 'rebolo_v2_2'], ['rebolo_v4_1', 'rebolo_v4_2']],
  rebolomute: [['rebolomute_1', 'rebolomute_2'], ['rebolomute_1', 'rebolomute_2']],
  // Tamborim: bongô agudo abafado, afinado mais agudo.
  tamborim: [['tamborim_v2_1', 'tamborim_v2_2'], ['tamborim_v3_1', 'tamborim_v3_2']],
  // Pandeiro: pele (frame drum pequeno) + platinelas (pandeirolas).
  pandeirograve: [['pandeirograve_1', 'pandeirograve_2'], ['pandeirograve_1', 'pandeirograve_2']],
  pandeiromute: [['pandeiromute_1', 'pandeiromute_2'], ['pandeiromute_1', 'pandeiromute_2']],
  platinela: [['platinela_v1', 'pandeiro_v1'], ['platinela_v2', 'pandeiro_v2']],
  // Surdo: frame drum grande, afinado mais grave.
  surdo: [['surdo_1', 'zabumba_2'], ['surdo_2', 'zabumba_1']],
  surdomute: [['surdomute_1', 'surdomute_2'], ['surdomute_2', 'zabumbamute_1']],
};

/**
 * Gravação pronta: buffer, onde o som começa de fato (MP3 tem um silêncio no início) e o ganho
 * que deixa o pico em ~0,9 (as notas ficam com o mesmo volume entre si).
 */
export type Sample = { buffer: AudioBuffer; offset: number; gain: number };

const cache = new Map<string, Sample | null>();
const loading = new Map<string, Promise<Sample | null>>();

function analyze(buffer: AudioBuffer): Sample {
  const d = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.02;
  let offset = 0;
  for (let i = 0; i < d.length; i++) {
    if (Math.abs(d[i]) > th) { offset = Math.max(0, i / buffer.sampleRate - 0.002); break; }
  }
  return { buffer, offset, gain: peak > 0 ? 0.9 / peak : 1 };
}

function load(ctx: BaseAudioContext, url: string): Promise<Sample | null> {
  const existing = loading.get(url);
  if (existing) return existing;
  const p = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => analyze(buffer))
    .catch(() => null)
    .then((s) => { cache.set(url, s); return s; });
  loading.set(url, p);
  return p;
}

const noteUrl = (bank: NoteBankId, midi: number) => `/samples/${bank}/${midi}.mp3`;
const drumUrl = (file: string) => `/samples/drums/${file}.wav`;

/** Começa a carregar um instrumento (todas as notas). Resolve quando terminar. */
export function preloadNotes(ctx: BaseAudioContext, bank: NoteBankId): Promise<void> {
  const { lo, hi } = NOTE_BANKS[bank];
  const all: Promise<unknown>[] = [];
  for (let m = lo; m <= hi; m++) all.push(load(ctx, noteUrl(bank, m)));
  return Promise.all(all).then(() => undefined);
}

const requested = new Set<string>();
/** Pede para carregar (uma vez só) sem esperar: na primeira vez toca sintetizado, depois gravado. */
export function ensureNotes(ctx: BaseAudioContext, bank: NoteBankId) {
  if (requested.has(bank)) return;
  requested.add(bank);
  void preloadNotes(ctx, bank);
}
export function ensureDrums(ctx: BaseAudioContext) {
  if (requested.has('drums')) return;
  requested.add('drums');
  void preloadDrums(ctx);
}

export function preloadDrums(ctx: BaseAudioContext): Promise<void> {
  const files = new Set(Object.values(DRUM_FILES).flat(2));
  return Promise.all([...files].map((f) => load(ctx, drumUrl(f)))).then(() => undefined);
}

/**
 * Gravação para tocar `midi` no instrumento: a do próprio semitom, ou a mais próxima afinada.
 * Null se ainda não carregou (quem chamou usa o som sintetizado).
 */
export function noteSample(bank: NoteBankId, midi: number): { sample: Sample; rate: number } | null {
  const { lo, hi } = NOTE_BANKS[bank];
  const m = Math.round(Math.min(hi, Math.max(lo, midi)));
  const sample = cache.get(noteUrl(bank, m));
  if (!sample) return null;
  return { sample, rate: Math.pow(2, (midi - m) / 12) };
}

const rr = new Map<string, number>();
/** Batida da peça: forte ou fraca, alternando as gravações (cada batida soa um pouco diferente). */
export function drumSample(id: DrumSampleId, strong: boolean): Sample | null {
  const files = DRUM_FILES[id][strong ? 1 : 0];
  const k = `${id}:${strong}`;
  const i = ((rr.get(k) ?? -1) + 1) % files.length;
  rr.set(k, i);
  return cache.get(drumUrl(files[i])) ?? null;
}
