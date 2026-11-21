import React from 'react';
import { detectPitch, rms } from '../utils/pitch/yin';
import { acquireMic, releaseMic } from '../utils/audio/sharedMic';
import { isSynthSounding, stopSynth } from '../utils/audio/synth';
import { songChordSequence } from '../utils/chords/songChords';
import {
  estimateShift, freqToMidi, keyFromProfile, midiToName, mod12, parseKey, profileFromChords, profileFromKey, type KeyEstimate,
} from '../utils/pitch/music';
import { useWakeLock } from './useWakeLock';

/**
 * Afinador + detecção de tom, tudo no navegador (Web Audio API, sem servidor).
 *
 * - A cada ~50 ms lê o microfone e detecta a nota cantada (YIN).
 * - Notas sustentadas (≥ 200 ms estáveis) entram nas estatísticas:
 *   quanto tempo em cada nota (para o tom) e o desvio em cents (para a afinação).
 * - A cada segundo compara as notas cantadas com os acordes da cifra na tela.
 */

const TICK_MS = 50;
const MIN_NOTE_FRAMES = 4; // ~200 ms
const KEY_MIN_SECONDS = 12; // tempo cantado necessário antes de opinar sobre o tom
const HIST_HALF_LIFE_S = 90; // notas antigas perdem peso
const IN_TUNE_CENTS = 25;

export type TunerReading = { note: string; octave: number; cents: number; /** altura exata (MIDI fracionário) */ midi: number };
export type SongKey = { tonic: number; minor: boolean };
export type TunerKey = (KeyEstimate & { progress: 1 }) | { status: 'analyzing'; progress: number } | { status: 'no-reference'; progress: 1 };
export type TunerStatus = 'idle' | 'starting' | 'listening' | 'error';

const ERRORS: Record<string, string> = {
  NotAllowedError: 'Permita o uso do microfone para o afinador.',
  SecurityError: 'Permita o uso do microfone para o afinador.',
  NotFoundError: 'Nenhum microfone encontrado.',
  NotReadableError: 'O microfone está em uso por outro aplicativo.',
};

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Acordes que estão na cifra exibida (já transpostos). */
function chordsOnScreen(root: HTMLElement | null): string[] {
  if (!root) return [];
  const out: string[] = [];
  root.querySelectorAll('[data-lyric-body] b').forEach((b) => {
    (b.textContent ?? '').split(/\s+/).forEach((s) => { if (s) out.push(s); });
  });
  return out;
}

const noopSubscribe = () => () => { };
const hasMic = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

type Options = {
  root: HTMLElement | null;
  /** Tom atual da cifra (ex.: "Am"), usado se a cifra não tiver acordes. */
  currentKey: string | null;
  lyricKey: string;
};

export function usePitchTuner({ root, currentKey, lyricKey }: Options) {
  const supported = React.useSyncExternalStore(noopSubscribe, hasMic, () => false);
  const [enabled, setEnabled] = React.useState(false);
  const [status, setStatus] = React.useState<TunerStatus>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState<TunerReading | null>(null);
  const [keyState, setKeyState] = React.useState<TunerKey>({ status: 'analyzing', progress: 0 });
  const [accuracy, setAccuracy] = React.useState<{ inTune: number; notes: number } | null>(null);
  /** Centro da voz de quem canta (MIDI), para tocar as notas de referência na altura certa. */
  const [voiceCenter, setVoiceCenter] = React.useState<number | null>(null);
  /** Tom deduzido dos acordes (quando a música não tem tom cadastrado). */
  const [chordKey, setChordKey] = React.useState<SongKey | null>(null);
  /** Acordes da música na ordem da cifra (para tocar junto). */
  const [songChords, setSongChords] = React.useState<string[]>([]);
  const recentNotesRef = React.useRef<number[]>([]);

  const histRef = React.useRef<number[]>(new Array(12).fill(0));
  const centsRef = React.useRef<number[]>([]);
  const rootRef = React.useRef(root);
  const currentKeyRef = React.useRef(currentKey);
  React.useEffect(() => { rootRef.current = root; }, [root]);
  React.useEffect(() => { currentKeyRef.current = currentKey; }, [currentKey]);

  // Música nova: estatísticas novas.
  const [prevKey, setPrevKey] = React.useState(lyricKey);
  if (prevKey !== lyricKey) {
    setPrevKey(lyricKey);
    setKeyState({ status: 'analyzing', progress: 0 });
    setAccuracy(null);
  }
  React.useEffect(() => {
    histRef.current = new Array(12).fill(0);
    centsRef.current = [];
  }, [lyricKey]);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      setStatus('starting');
      try {
        // Mesmo microfone do "seguir a voz" (abrir outro interromperia o reconhecimento).
        stream = await acquireMic();
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException)?.name ?? '';
        setError(ERRORS[name] ?? 'Não foi possível abrir o microfone.');
        setStatus('error');
        setEnabled(false);
        return;
      }
      if (cancelled) {
        releaseMic();
        stream = null;
        return;
      }

      ctx = new AudioContext();
      await ctx.resume().catch(() => { });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const raw = new Float32Array(analyser.fftSize);
      // Reduz a taxa pela metade: a voz não passa de ~1 kHz e o cálculo fica 4x mais leve.
      const factor = ctx.sampleRate >= 44100 ? 2 : 1;
      const sr = ctx.sampleRate / factor;
      const buf = new Float32Array(raw.length / factor);

      let noise = 0.01;
      let seg: number[] = [];
      let smooth = 0;
      let lastVoicedAt = 0;
      let lastUiAt = 0;
      let lastKeyAt = 0;
      const decay = Math.pow(0.5, TICK_MS / 1000 / HIST_HALF_LIFE_S);

      const closeSegment = () => {
        // O som de referência tocado pelo app não conta como canto.
        if (isSynthSounding()) {
          seg = [];
          return;
        }
        if (seg.length >= MIN_NOTE_FRAMES) {
          const m = median(seg);
          histRef.current[mod12(Math.round(m))] += (seg.length * TICK_MS) / 1000;
          centsRef.current = [...centsRef.current, (m - Math.round(m)) * 100].slice(-30);
          recentNotesRef.current = [...recentNotesRef.current, m].slice(-40);
        }
        seg = [];
      };

      const evaluate = () => {
        const notes = recentNotesRef.current;
        if (notes.length >= 3) setVoiceCenter(Math.round(median(notes)));
        const seq = songChordSequence(rootRef.current);
        setSongChords((prev) => (prev.length === seq.length && prev.every((c, i) => c === seq[i]) ? prev : seq));
        const chordProfile = profileFromChords(chordsOnScreen(rootRef.current));
        if (chordProfile) {
          const k = keyFromProfile(chordProfile);
          setChordKey((prev) => (prev && prev.tonic === k.tonic && prev.minor === k.minor ? prev : k));
        }
        const cents = centsRef.current;
        if (cents.length >= 5) {
          setAccuracy({ inTune: cents.filter((c) => Math.abs(c) <= IN_TUNE_CENTS).length / cents.length, notes: cents.length });
        }
        const hist = histRef.current;
        const total = hist.reduce((s, v) => s + v, 0);
        if (total < KEY_MIN_SECONDS) {
          setKeyState({ status: 'analyzing', progress: total / KEY_MIN_SECONDS });
          return;
        }
        const key = parseKey(currentKeyRef.current);
        const profile = chordProfile ?? (key ? profileFromKey(key.tonic, key.minor) : null);
        setKeyState(profile ? { ...estimateShift(hist, profile), progress: 1 } : { status: 'no-reference', progress: 1 });
      };

      setStatus('listening');
      evaluate();

      interval = setInterval(() => {
        const now = performance.now();
        analyser.getFloatTimeDomainData(raw);
        if (factor === 2) for (let i = 0; i < buf.length; i++) buf[i] = (raw[2 * i] + raw[2 * i + 1]) / 2;
        else buf.set(raw);

        for (let i = 0; i < 12; i++) histRef.current[i] *= decay;

        // Ruído de fundo adaptativo: só analisa o que está claramente acima dele.
        const level = rms(buf);
        noise = level < noise ? level : noise + (level - noise) * 0.002;
        const gate = Math.max(0.006, noise * 2.5);

        const p = level > gate ? detectPitch(buf, sr) : null;
        if (p && p.clarity >= 0.85) {
          const midi = freqToMidi(p.freq);
          if (seg.length && Math.abs(midi - median(seg)) > 0.5) closeSegment();
          if (!seg.length) smooth = midi;
          seg.push(midi);
          smooth += (midi - smooth) * 0.35;
          lastVoicedAt = now;
        } else {
          closeSegment();
        }

        if (now - lastUiAt > 100) {
          lastUiAt = now;
          if (now - lastVoicedAt < 400) {
            const { name, octave } = midiToName(smooth);
            setReading({ note: name, octave, cents: Math.round((smooth - Math.round(smooth)) * 100), midi: smooth });
          } else {
            setReading(null);
          }
        }
        if (now - lastKeyAt > 1000) {
          lastKeyAt = now;
          evaluate();
        }
      }, TICK_MS);
    };

    run();

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (stream) releaseMic();
      ctx?.close().catch(() => { });
      stopSynth();
      setStatus('idle');
      setReading(null);
    };
  }, [enabled]);

  useWakeLock(enabled);

  const toggle = React.useCallback(() => {
    setError(null);
    setEnabled((v) => !v);
  }, []);

  /** Depois de mudar o tom da cifra, os acordes na tela mudam e a análise se refaz sozinha. */
  return {
    supported,
    enabled,
    listening: status === 'listening',
    error,
    reading,
    keyState,
    accuracy,
    voiceCenter,
    songChords,
    /** Tom da música: o cadastrado (com a transposição) ou, sem ele, o deduzido dos acordes. */
    songKey: parseKey(currentKey) ?? chordKey,
    toggle,
  };
}
