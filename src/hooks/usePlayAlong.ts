/**
 * "Tocar junto": metrônomo com uma banda (violão, guitarra, teclado, sanfona, baixo, bateria...)
 * tocando o acorde atual da música no ritmo escolhido.
 *
 * - Começa com um compasso só de cliques (contagem) e depois a banda entra.
 * - Pedir outro acorde (setas, "Próximo", tocar num acorde) não troca na hora: a troca cai no
 *   tempo mais próximo. Se o pedido veio um pouco antes do tempo, troca nele; se veio um pouco
 *   depois (até ~30% do tempo), troca na hora como se tivesse sido no tempo; senão, no próximo.
 * - Os sons são agendados no relógio do áudio (não do JavaScript), então o tempo não oscila.
 */
import React from 'react';
import { audioTime, cancelVoicesFrom, playClick, releaseVoices, type StrokeOptions } from '../utils/chords/chordAudio';
import { playChordByName } from '../utils/chords/songChords';
import {
  barLength, beatsPerBar as barBeats, getRhythm, RHYTHMS, DEFAULT_RHYTHM_ID, strokeFor,
  type DrumGroove, type MelodicPartId, type Rhythm,
} from '../utils/chords/rhythms';
import {
  BAND_PARTS, DEFAULT_BAND, PERC_IDS, chordStrokeFor, playBassStep, playDrum, playPerc, playSanfonaStep, preloadPart,
  type BandPart, type BandPartId, type DrumId, type PercId,
} from '../utils/chords/band';
import { markSounding } from '../utils/audio/synth';

export const MIN_BPM = 40;
export const MAX_BPM = 220;

/** Quanto à frente os sons são agendados (s) e de quanto em quanto tempo o agendador roda (ms). */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
/** Atraso aceito para ainda trocar "no tempo que passou" (s). */
const lateTolerance = (beatDur: number) => Math.min(0.15, beatDur * 0.3);
/** Toque usado quando o acorde muda num passo sem toque no ritmo. */
const CHANGE_STROKE: StrokeOptions = { part: 'all', gain: 0.6 };

const BPM_KEY = 'practice-bpm';
const RHYTHM_KEY = 'practice-rhythm';
const CLICK_KEY = 'practice-click';
const BAND_KEY = 'practice-band';
/** Marca que a percussão (que veio depois) já foi ligada na banda salva. */
const BAND_PERC_KEY = 'practice-band-perc';
/** Instrumento escolhido antes de existir a banda (vira o instrumento de acorde da banda). */
const OLD_INSTRUMENT_KEY = 'practice-instrument';

function readStored<T>(key: string, fallback: T, valid: (v: string) => T | null): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw != null) return valid(raw) ?? fallback;
  } catch { }
  return fallback;
}
function store(key: string, v: string | number) {
  try { window.localStorage.setItem(key, String(v)); } catch { }
}
const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

function readBand(): BandPartId[] {
  const stored = readStored<BandPartId[] | null>(BAND_KEY, null, (v) => {
    const ids = v.split(',').filter((id): id is BandPartId => BAND_PARTS.some((p) => p.id === id));
    return ids;
  });
  if (stored) {
    // Banda salva antes de existir a percussão: liga a percussão (ela só toca nos ritmos que a usam).
    if (!readStored(BAND_PERC_KEY, false, (v) => v === '1')) {
      const withPerc = [...stored, ...PERC_IDS.filter((id) => !stored.includes(id))];
      store(BAND_PERC_KEY, '1');
      store(BAND_KEY, withPerc.join(','));
      return withPerc;
    }
    return stored;
  }
  const old = readStored(OLD_INSTRUMENT_KEY, 'guitar', (v) => v);
  const lead = BAND_PARTS.find((p) => p.role === 'chord' && p.instrumentId === old)?.id ?? 'violao';
  return [lead, ...DEFAULT_BAND.filter((id) => id !== 'violao')];
}

const partById = (id: BandPartId) => BAND_PARTS.find((p) => p.id === id)!;

/**
 * O jeito de cada músico tocar. Ninguém toca exatamente no tempo nem sempre igual:
 * - late/jitter: quanto chega depois do tempo, em média, e quanto isso varia (s). O cavaco
 *   "puxa" (chega um tiquinho antes); baixo e bateria seguram o tempo; a sanfona respira.
 * - vel: quanto a força de cada toque varia.
 * - skipSoft: chance de pular uma batida fraca (quem toca não faz todas as "subidas").
 * - change: chance de mudar de levada a cada compasso.
 */
type Persona = { late: number; jitter: number; vel: number; skipSoft: number; change: number };
const PERSONAS: Record<BandPartId, Persona> = {
  violao: { late: 0.006, jitter: 0.006, vel: 0.1, skipSoft: 0.1, change: 0.3 },
  cavaquinho: { late: -0.003, jitter: 0.004, vel: 0.12, skipSoft: 0.12, change: 0.35 },
  banjo: { late: -0.002, jitter: 0.004, vel: 0.12, skipSoft: 0.1, change: 0.35 },
  ukulele: { late: 0.004, jitter: 0.006, vel: 0.12, skipSoft: 0.12, change: 0.3 },
  guitarra: { late: 0.009, jitter: 0.005, vel: 0.08, skipSoft: 0.05, change: 0.25 },
  teclado: { late: 0.004, jitter: 0.005, vel: 0.08, skipSoft: 0.1, change: 0.35 },
  sanfona: { late: 0.01, jitter: 0.008, vel: 0.06, skipSoft: 0, change: 0.25 },
  baixo: { late: 0.001, jitter: 0.003, vel: 0.07, skipSoft: 0, change: 0.3 },
  bateria: { late: 0, jitter: 0.003, vel: 0.12, skipSoft: 0.1, change: 0.3 },
  // Percussão: o surdo é a referência; tamborim "puxa", rebolo conversa (varia bastante).
  surdo: { late: 0, jitter: 0.003, vel: 0.06, skipSoft: 0.05, change: 0.2 },
  rebolo: { late: 0.004, jitter: 0.005, vel: 0.12, skipSoft: 0.1, change: 0.4 },
  pandeiro: { late: 0.001, jitter: 0.003, vel: 0.14, skipSoft: 0.05, change: 0.3 },
  tamborim: { late: -0.002, jitter: 0.003, vel: 0.1, skipSoft: 0.05, change: 0.4 },
  ganza: { late: 0.003, jitter: 0.004, vel: 0.15, skipSoft: 0.05, change: 0.2 },
  triangulo: { late: 0.002, jitter: 0.003, vel: 0.1, skipSoft: 0.03, change: 0.2 },
  zabumba: { late: 0, jitter: 0.003, vel: 0.08, skipSoft: 0.05, change: 0.3 },
};
const humanTime = (id: BandPartId) => PERSONAS[id].late + (Math.random() * 2 - 1) * PERSONAS[id].jitter;
const humanVel = (id: BandPartId) => 1 + (Math.random() * 2 - 1) * PERSONAS[id].vel;

/** Acento natural do compasso: o "1" mais forte, os tempos firmes, os contratempos mais leves. */
function metricAccent(step: number, sub: number): number {
  const inBeat = step % sub;
  if (inBeat === 0) return step === 0 ? 1 : 0.93;
  if (sub === 4 && inBeat !== 2) return 0.78;
  return 0.86;
}

/** Sorteia uma variação: a principal (0) tem o dobro de chance das outras. */
function pickVariant(count: number): number {
  const r = Math.random() * (count + 1);
  return r < 2 ? 0 : Math.min(count - 1, Math.floor(r - 1));
}

/**
 * Levada do instrumento no ritmo; instrumento de acorde sem levada própria segue a do violão.
 * Percussão só toca nos ritmos que a têm.
 */
function partLines(r: Rhythm, part: BandPart): string[] | undefined {
  if (part.role === 'perc') return r.perc?.[part.id as PercId];
  if (part.role === 'drums') return undefined;
  const own = r.parts[part.id as MelodicPartId];
  if (own?.length) return own;
  return part.role === 'chord' ? r.parts.violao : undefined;
}

type Options = {
  chords: string[];
  /** Acorde atual mostrado na faixa (-1 = nenhum ainda). */
  pos: number;
  setPos: (i: number) => void;
};

/** `base`: o passo no tempo exato (sem o "atraso humano"), para achar o que caiu num tempo. */
type Scheduled = { time: number; base: number; part: BandPartId; step: number };

type Engine = {
  timer: number;
  /** Compassos tocados (depois da contagem), para montar frases de 4/8 compassos. */
  bar: number;
  /** Levada que cada músico está tocando neste compasso, e quão forte (varia devagar). */
  variant: Partial<Record<BandPartId, number>>;
  intensity: Partial<Record<BandPartId, number>>;
  /** Groove da bateria neste compasso. */
  groove: number;
  /**
   * Virada pedida: a partir de que passo deste compasso ela toca (null = sem virada), se fica
   * para o próximo compasso (pedida em cima do fim deste) e se vem prato depois dela.
   */
  fillFrom: number | null;
  fillNext: boolean;
  crashNext: boolean;
  /** Passo do compasso a agendar e quando ele soa (relógio do áudio). */
  barStep: number;
  nextStepTime: number;
  /** Ainda no compasso de contagem. */
  countIn: boolean;
  /** Acorde que está soando na banda e o pedido de troca ainda não aplicado. */
  chordPos: number;
  pending: number | null;
  /** Último tempo agendado (e em que passo do compasso ele caiu). */
  lastBeat: { time: number; countIn: boolean; step: number } | null;
  /** Toques que dependem do acorde e talvez ainda não tenham soado (para refazer se ele mudar). */
  scheduled: Scheduled[];
  uiTimers: Set<number>;
};

export function usePlayAlong({ chords, pos, setPos }: Options) {
  const [bpm, setBpmState] = React.useState(() => readStored(BPM_KEY, 80, (v) => (Number(v) > 0 ? clampBpm(Number(v)) : null)));
  const [rhythmId, setRhythmIdState] = React.useState(() =>
    readStored(RHYTHM_KEY, DEFAULT_RHYTHM_ID, (v) => (RHYTHMS.some((r) => r.id === v) ? v : null)));
  const [clickOn, setClickOnState] = React.useState(() => readStored(CLICK_KEY, true, (v) => v === '1'));
  const [band, setBandState] = React.useState<BandPartId[]>(readBand);
  const [running, setRunning] = React.useState(false);
  /** Tempo atual dentro do compasso (-1 = parado) e se ainda está na contagem. */
  const [beat, setBeat] = React.useState(-1);
  const [countingIn, setCountingIn] = React.useState(false);
  /** Acorde pedido que vai entrar no próximo tempo. */
  const [queued, setQueued] = React.useState<number | null>(null);
  /** Virada: pedida (esperando o próximo tempo), tocando ou nada. */
  const [fill, setFill] = React.useState<'idle' | 'queued' | 'playing'>('idle');

  const rhythm = getRhythm(rhythmId);
  /** Instrumento de acorde principal: toca quando se toca num acorde com a banda parada. */
  const lead: BandPart = BAND_PARTS.find((p) => p.role === 'chord' && band.includes(p.id)) ?? partById('violao');

  // Valores atuais para o agendador (que roda fora do ciclo do React).
  const live = React.useRef({ chords, pos, setPos, bpm, rhythm, clickOn, band, lead });
  React.useLayoutEffect(() => {
    live.current = { chords, pos, setPos, bpm, rhythm, clickOn, band, lead };
  });

  const engine = React.useRef<Engine | null>(null);

  /** Atualiza a tela quando o som de `time` de fato tocar. */
  const atTime = React.useCallback((time: number, fn: () => void) => {
    const e = engine.current;
    const now = audioTime();
    if (!e || now == null) return;
    const id = window.setTimeout(() => {
      e.uiTimers.delete(id);
      if (engine.current === e) fn();
    }, Math.max(0, (time - now) * 1000));
    e.uiTimers.add(id);
  }, []);

  /**
   * Toca o passo `step` do ritmo num instrumento que depende do acorde (não a bateria).
   * `forced`: o acorde acabou de mudar aqui, então o instrumento entra mesmo se o ritmo tem pausa.
   */
  const playPart = React.useCallback((part: BandPart, time: number, step: number, forced: boolean, base = time) => {
    const e = engine.current;
    const { chords: list, rhythm: r } = live.current;
    if (!e || list.length === 0) return;
    const chord = list[Math.min(e.chordPos, list.length - 1)];
    const lines = partLines(r, part);
    const line = lines?.[e.variant[part.id] ?? 0] ?? lines?.[0];
    let ch = line?.[step] ?? '.';
    // Quem toca não faz todas as batidas fracas, e cada toque sai com uma força um pouco diferente.
    if (!forced && (ch === 'd' || ch === 'u') && Math.random() < PERSONAS[part.id].skipSoft) return;
    const dyn = metricAccent(step, r.sub) * (e.intensity[part.id] ?? 1) * humanVel(part.id);
    let played = false;

    if (part.role === 'chord') {
      let opts = strokeFor(ch);
      if (forced) opts = { ...(opts ?? CHANGE_STROKE), damp: true };
      if (opts) {
        const stroke = { ...opts, gain: (opts.gain ?? 1) * dyn };
        played = playChordByName(chord, part.instrumentId!, { ...chordStrokeFor(part, stroke), when: time });
      }
    } else if (part.role === 'bass') {
      if (!line) ch = step === 0 ? 'R' : '.';
      if (forced && (ch === '.' || ch === '-')) ch = 'R';
      played = playBassStep(chord, ch, time, part.level * dyn);
    } else if (part.role === 'sanfona') {
      if (!line) ch = step === 0 ? 'S' : '-';
      if (forced && (ch === '.' || ch === '-')) ch = 'S';
      played = playSanfonaStep(chord, ch, time, part.level * dyn);
    }

    if (played) {
      const now = audioTime() ?? 0;
      markSounding(Math.max(0, time - now) * 1000 + 2500);
      e.scheduled = e.scheduled.filter((s) => s.time > now - 0.05);
      e.scheduled.push({ time, base, part: part.id, step });
    }
  }, []);

  /** Começo de compasso: cada músico decide se continua na levada ou varia; a bateria planeja a virada. */
  const planBar = React.useCallback((e: Engine, r: Rhythm) => {
    e.bar += 1;
    const phraseStart = e.bar % 4 === 0;
    for (const part of BAND_PARTS) {
      const p = PERSONAS[part.id];
      const count = part.role === 'drums' ? r.drums?.length ?? 0 : partLines(r, part)?.length ?? 0;
      if (count === 0) continue;
      let v = part.role === 'drums' ? e.groove : e.variant[part.id] ?? 0;
      // No começo da frase quase sempre volta para a levada principal.
      if (phraseStart) v = Math.random() < 0.7 ? 0 : v;
      else if (Math.random() < p.change) v = pickVariant(Math.max(1, count));
      if (part.role === 'drums') e.groove = Math.min(v, Math.max(0, count - 1));
      else e.variant[part.id] = Math.min(v, Math.max(0, count - 1));
      // A força de cada um varia devagar (ninguém toca o tempo todo igual).
      const prev = e.intensity[part.id] ?? 0.95;
      e.intensity[part.id] = Math.min(1.05, Math.max(0.84, prev + (Math.random() * 2 - 1) * 0.05));
    }
    // Virada só quando pedida: se ficou para este compasso, toca ele inteiro; depois dela, prato.
    e.crashNext = e.fillFrom != null;
    e.fillFrom = e.fillNext ? 0 : null;
    e.fillNext = false;
  }, []);

  const scheduleStep = React.useCallback((time: number) => {
    const e = engine.current!;
    const { rhythm: r, clickOn: click, chords: list, band: on, bpm: tempo } = live.current;
    const step = e.barStep % barLength(r);
    const onBeat = step % r.sub === 0;
    const beatInBar = Math.floor(step / r.sub);
    const countIn = e.countIn;
    if (step === 0 && !countIn) {
      planBar(e, r);
      if (e.crashNext && e.fillFrom == null) atTime(time, () => setFill('idle'));
    }
    const filling = !countIn && e.fillFrom != null && step >= e.fillFrom;
    if (filling && step === e.fillFrom) atTime(time, () => setFill('playing'));
    // Balanço: o contratempo atrasa um pouquinho (samba, bossa, reggae).
    const swing = r.swing && r.sub >= 2 && step % 2 === 1 ? r.swing * (60 / tempo / r.sub) : 0;

    let changed = false;
    if (onBeat) {
      if (click || r.id === 'click' || countIn) playClick(time, beatInBar === 0);
      if (!countIn && e.pending != null) {
        changed = e.pending !== e.chordPos;
        e.chordPos = e.pending;
        e.pending = null;
      }
      if (e.chordPos >= list.length) e.chordPos = 0;
      atTime(time, () => {
        setBeat(beatInBar);
        setCountingIn(countIn);
        if (!countIn) {
          // Lê na hora: uma troca feita em cima do tempo (já agendado) também vale aqui.
          live.current.setPos(e.chordPos);
          setQueued(e.pending);
        }
      });
      e.lastBeat = { time, countIn, step };
    }

    if (!countIn && r.id !== 'click') {
      for (const part of BAND_PARTS) {
        if (!on.includes(part.id)) continue;
        if (part.role === 'drums') {
          if (!r.drums) continue;
          const groove: DrumGroove = { ...(r.drums[e.groove] ?? r.drums[0]), ...(filling ? r.fill?.drums : undefined) };
          if (step === 0 && e.crashNext) playDrum('o', 'X', time, part.level * 0.9);
          for (const [drum, line] of Object.entries(groove)) {
            const hit = line?.[step];
            if (!hit || hit === '.') continue;
            if (hit === 'g' && !filling && Math.random() < PERSONAS.bateria.skipSoft) continue;
            const dyn = metricAccent(step, r.sub) * (e.intensity.bateria ?? 1) * humanVel('bateria');
            playDrum(drum as DrumId, hit, time + swing + humanTime('bateria'), part.level * dyn);
          }
        } else if (part.role === 'perc') {
          const id = part.id as PercId;
          const lines = r.perc?.[id];
          if (!lines) continue;
          const fillLine = filling ? r.fill?.perc?.[id] : undefined;
          const hit = (fillLine ?? lines[e.variant[id] ?? 0] ?? lines[0])[step];
          if (!hit || hit === '.' || hit === '-') continue;
          if ((hit === 'g' || hit === 'p') && !fillLine && Math.random() < PERSONAS[id].skipSoft) continue;
          // Prato depois da virada, nos ritmos sem bateria: o surdo marca o "1" mais forte.
          const boost = step === 0 && e.crashNext && id === 'surdo' ? 1.3 : 1;
          const dyn = metricAccent(step, r.sub) * (e.intensity[id] ?? 1) * humanVel(id) * boost;
          playPerc(id, hit, time + swing + humanTime(id), part.level * dyn);
        } else {
          playPart(part, time + swing + humanTime(part.id), step, changed, time);
        }
      }
    }

    e.barStep = step + 1;
    if (e.barStep >= barLength(r)) {
      e.barStep = 0;
      e.countIn = false;
    }
  }, [atTime, playPart, planBar]);

  const stop = React.useCallback(() => {
    const e = engine.current;
    if (!e) return;
    window.clearInterval(e.timer);
    e.uiTimers.forEach((id) => window.clearTimeout(id));
    engine.current = null;
    releaseVoices();
    setRunning(false);
    setBeat(-1);
    setCountingIn(false);
    setQueued(null);
    setFill('idle');
  }, []);

  /**
   * Pede uma virada: entra no próximo tempo e vai até o fim do compasso (se sobrar pelo menos um
   * tempo); senão, toca o compasso seguinte inteiro. Depois dela, prato no "1".
   */
  const requestFill = React.useCallback((): boolean => {
    const e = engine.current;
    const r = live.current.rhythm;
    if (!e || e.countIn || !r.fill) return false;
    if (e.fillFrom != null || e.fillNext) return true;
    const n = barLength(r);
    let s = e.barStep;
    while (s % r.sub !== 0) s += 1;
    if (e.barStep > 0 && n - s >= r.sub) e.fillFrom = s;
    else e.fillNext = true;
    setFill('queued');
    return true;
  }, []);

  const start = React.useCallback(() => {
    const now = audioTime();
    const { chords: list, pos: p } = live.current;
    if (now == null || list.length === 0 || engine.current) return;
    const first = Math.min(Math.max(p, 0), list.length - 1);
    const e: Engine = {
      timer: 0,
      bar: -1,
      variant: {},
      intensity: {},
      groove: 0,
      fillFrom: null,
      fillNext: false,
      crashNext: false,
      barStep: 0,
      nextStepTime: now + 0.1,
      countIn: true,
      chordPos: first,
      pending: null,
      lastBeat: null,
      scheduled: [],
      uiTimers: new Set(),
    };
    engine.current = e;
    live.current.setPos(first);
    setRunning(true);
    setCountingIn(true);

    const run = () => {
      const t = audioTime();
      if (t == null || engine.current !== e) return;
      // Aba ficou parada (ex.: em segundo plano): não tenta "recuperar" os passos perdidos.
      if (e.nextStepTime < t - 0.2) e.nextStepTime = t + 0.05;
      while (e.nextStepTime < t + LOOKAHEAD_S) {
        scheduleStep(e.nextStepTime);
        const { bpm: b, rhythm: r } = live.current;
        e.nextStepTime += 60 / b / r.sub;
      }
    };
    e.timer = window.setInterval(run, TICK_MS);
    run();
  }, [scheduleStep]);

  /**
   * Pede para ir ao acorde `i` no tempo certo. Retorna false se o metrônomo está parado
   * (aí quem chamou toca na hora, como antes).
   */
  const request = React.useCallback((i: number): boolean => {
    const e = engine.current;
    const now = audioTime();
    if (!e || now == null) return false;
    const beatDur = 60 / live.current.bpm;
    const b = e.lastBeat;
    const silent = live.current.rhythm.id === 'click';

    /** Troca já no tempo `b` (que está para soar ou acabou de soar) e refaz o que vinha depois. */
    const applyNow = (beat: NonNullable<typeof b>, late: boolean) => {
      const from = late ? now + 0.025 : beat.time;
      const redo = e.scheduled.filter((s) => s.time >= from && s.base !== beat.time);
      e.scheduled = e.scheduled.filter((s) => s.time < from);
      cancelVoicesFrom(from);
      e.chordPos = i;
      e.pending = null;
      setQueued(null);
      if (!silent) {
        const at = late ? now + 0.02 : beat.time;
        BAND_PARTS
          .filter((p) => p.role !== 'drums' && live.current.band.includes(p.id))
          .forEach((p) => playPart(p, at + Math.max(0, humanTime(p.id)), beat.step, true, at));
        redo.forEach((s) => playPart(partById(s.part), s.time, s.step, false, s.base));
      }
      if (late) live.current.setPos(i);
      else atTime(beat.time, () => live.current.setPos(i));
    };

    if (b && !b.countIn && b.time > now) applyNow(b, false); // um pouco antes do tempo que já vai soar
    else if (b && !b.countIn && now - b.time <= lateTolerance(beatDur)) applyNow(b, true); // um pouco atrasado
    else {
      e.pending = i;
      setQueued(i);
    }
    return true;
  }, [atTime, playPart]);

  /** Acorde "atual" para calcular o próximo/anterior (considera o pedido ainda na fila). */
  const current = React.useCallback((): number | null => {
    const e = engine.current;
    return e ? e.pending ?? e.chordPos : null;
  }, []);

  // Batida feita à mão (↑ ↓) enquanto a banda toca: soa na hora no instrumento principal.
  const manualStrum = React.useCallback((reverse: boolean): boolean => {
    const e = engine.current;
    const { chords: list, lead: l } = live.current;
    if (!e || list.length === 0) return false;
    const chord = list[Math.min(e.chordPos, list.length - 1)];
    if (playChordByName(chord, l.instrumentId!, chordStrokeFor(l, { part: 'all', reverse }))) markSounding(2500);
    return true;
  }, []);

  // Tap tempo: média dos últimos toques.
  const taps = React.useRef<number[]>([]);
  const tap = React.useCallback(() => {
    const now = performance.now();
    const list = taps.current.filter((t) => now - t < 2500);
    list.push(now);
    taps.current = list.slice(-5);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, idx) => t - taps.current[idx]);
      const avg = gaps.reduce((a, g) => a + g, 0) / gaps.length;
      const v = clampBpm(60000 / avg);
      setBpmState(v);
      store(BPM_KEY, v);
    }
  }, []);

  const setBpm = React.useCallback((v: number) => {
    const c = clampBpm(v);
    setBpmState(c);
    store(BPM_KEY, c);
  }, []);
  const setRhythmId = React.useCallback((id: string) => {
    setRhythmIdState(id);
    store(RHYTHM_KEY, id);
    // Começa o ritmo novo do início do compasso.
    if (engine.current) engine.current.barStep = 0;
  }, []);
  const setClickOn = React.useCallback((on: boolean) => {
    setClickOnState(on);
    store(CLICK_KEY, on ? '1' : '0');
  }, []);
  const togglePart = React.useCallback((id: BandPartId) => {
    setBandState((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      store(BAND_KEY, next.join(','));
      return next;
    });
    // Tirou da banda: para de soar na hora (ex.: sanfona segurando o acorde).
    releaseVoices(id);
  }, []);

  // Já vai carregando as gravações dos instrumentos ligados, para soarem desde o primeiro tempo.
  React.useEffect(() => {
    band.forEach(preloadPart);
  }, [band]);

  // Música sem acordes ou painel fechado: para.
  React.useEffect(() => {
    if (chords.length === 0) stop();
  }, [chords.length, stop]);
  React.useEffect(() => stop, [stop]);

  return {
    running, start, stop, request, current, manualStrum,
    beat, countingIn, queued,
    bpm, setBpm, tap,
    rhythm, setRhythmId,
    fill, requestFill, hasFill: !!rhythm.fill,
    beatsPerBar: barBeats(rhythm),
    clickOn, setClickOn,
    band, togglePart, lead,
  };
}
