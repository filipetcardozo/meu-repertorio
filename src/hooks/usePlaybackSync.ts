/**
 * Playback sincronizado no modo show.
 *
 * - Lista (ao vivo) os playbacks do usuário para a música e lembra o escolhido no aparelho.
 * - Toca o mp3; a cada quadro acha o ponto da linha do tempo (gerada pela Cloud Function) e manda o
 *   `useLyricFollow` destacar a linha e rolar até ela.
 * - As linhas são localizadas na tela pelo TEXTO (não pela posição), então funciona com a quebra de
 *   linha do celular, com o modo compacto e com tablaturas escondidas.
 * - Toque numa linha pula o áudio para ela. Ao terminar, pode passar para a próxima música do repertório.
 */
import React from 'react';
import { tokenize } from '../utils/lyricFollow/aligner';
import type { LyricLine } from '../utils/lyricFollow/domLines';
import type { PlaybackSyncItem, PlaybackType } from '../types/playbackType';
import {
  loadPickedPlayback, playbackUrl, savePickedPlayback, watchPlaybacks,
} from '../providers/playbacks/services';

/** O destaque entra um pouco antes da frase (dá tempo de ler). */
const LEAD_S = 0.25;
/** Ao pular para uma linha, começa um pouco antes dela. */
const SEEK_PREROLL_S = 0.6;
const AUTO_NEXT_KEY = 'playback:auto-next';
const RATES = [0.75, 0.85, 1, 1.1, 1.25];

type External = {
  active: boolean;
  activate: (on: boolean) => void;
  follow: (line: number | null, upcoming?: number | null) => void;
  getLines: () => LyricLine[];
  onLineClickRef: React.MutableRefObject<((line: number) => void) | null>;
};

function overlap(a: string[], b: Set<string>): number {
  if (!a.length || !b.size) return 0;
  const sa = new Set(a);
  let inter = 0;
  sa.forEach((w) => { if (b.has(w)) inter++; });
  return inter / (sa.size + b.size - inter);
}

/** Para cada item da linha do tempo, a linha da tela (ou null). */
function mapTimeline(timeline: PlaybackSyncItem[], lines: LyricLine[]): (number | null)[] {
  const sets = lines.map((l) => new Set(l.tokens));
  const cache = new Map<string, number | null>();
  return timeline.map((it) => {
    if (!it.text) return null;
    const key = `${it.text}|${it.lyricIdx ?? ''}`;
    if (cache.has(key)) return cache.get(key)!;
    const tokens = tokenize(it.text);
    let best: number | null = null;
    let bestScore = 0.45;
    for (let i = 0; i < lines.length; i++) {
      // uma linha da cifra pode ter virado duas na tela (quebra de linha do celular)
      const joined = i + 1 < lines.length ? new Set([...sets[i], ...sets[i + 1]]) : sets[i];
      const s = Math.max(overlap(tokens, sets[i]), overlap(tokens, joined) - 0.02)
        - (it.lyricIdx != null ? 0.002 * Math.abs(i - it.lyricIdx) : 0);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    cache.set(key, best);
    return best;
  });
}

export function usePlaybackSync(opts: {
  lyricId: string;
  uid?: string;
  external: External;
  /** Repertório: passa para a próxima música quando o playback termina. */
  onNext?: () => void;
}) {
  const { lyricId, uid, external, onNext } = opts;
  const [tracks, setTracks] = React.useState<PlaybackType[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [pickedId, setPickedId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false); // barra do player visível
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [rate, setRateState] = React.useState(1);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [autoNext, setAutoNextState] = React.useState<boolean>(() => {
    try { return window.localStorage.getItem(AUTO_NEXT_KEY) !== '0'; } catch { return true; }
  });

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const continueRef = React.useRef(false); // veio do fim da música anterior: já toca a próxima
  const externalRef = React.useRef(external);
  const onNextRef = React.useRef(onNext);
  React.useEffect(() => {
    externalRef.current = external;
    onNextRef.current = onNext;
  });

  // ---------- Lista de playbacks ----------
  // Troca de música: zera a lista e lê o playback escolhido para ela (durante a renderização, sem efeito).
  const listKey = `${uid ?? ''}|${lyricId}`;
  const [prevListKey, setPrevListKey] = React.useState<string | null>(null);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setTracks([]);
    setLoaded(false);
    setPickedId(typeof window === 'undefined' || !lyricId ? null : loadPickedPlayback(lyricId));
  }
  React.useEffect(() => {
    if (!uid || !lyricId) return;
    return watchPlaybacks(lyricId, uid, (list) => { setTracks(list); setLoaded(true); }, () => setLoaded(true));
  }, [lyricId, uid]);

  const track = React.useMemo(() => {
    const ready = tracks.filter((t) => t.status === 'ready');
    return tracks.find((t) => t.id === pickedId) ?? ready[0] ?? tracks[0] ?? null;
  }, [tracks, pickedId]);
  const readyTrack = track?.status === 'ready' && track.timeline?.length ? track : null;

  const pick = React.useCallback((id: string) => {
    setPickedId(id);
    savePickedPlayback(lyricId, id);
    setOpen(true);
  }, [lyricId]);

  // ---------- Áudio ----------
  React.useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    audioRef.current = a;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => setDuration(a.duration || 0);
    const onTime = () => setTime(a.currentTime);
    const onErr = () => setAudioError('Não foi possível carregar o áudio.');
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('error', onErr);
    return () => {
      a.pause();
      a.removeAttribute('src');
      a.load();
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('error', onErr);
      audioRef.current = null;
    };
  }, []);

  // Troca de faixa (ou de música): carrega o arquivo novo.
  const srcPath = readyTrack?.storagePath ?? null;
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setTime(0);
    setDuration(0);
    setAudioError(null);
    if (!srcPath) { a.removeAttribute('src'); return; }
    let alive = true;
    playbackUrl(srcPath)
      .then((url) => {
        if (!alive) return;
        a.src = url;
        a.playbackRate = rate;
        if (continueRef.current) {
          continueRef.current = false;
          setOpen(true);
          a.play().catch(() => undefined);
        }
      })
      .catch(() => alive && setAudioError('Não foi possível carregar o áudio.'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcPath]);

  // Música nova sem playback pronto: não continua tocando sozinha.
  React.useEffect(() => {
    if (loaded && !readyTrack) continueRef.current = false;
  }, [loaded, readyTrack]);

  // Liga o modo "seguir o áudio" enquanto o player está aberto.
  const active = open && !!readyTrack;
  React.useEffect(() => {
    externalRef.current.activate(active);
    return () => externalRef.current.activate(false);
  }, [active]);

  // ---------- Sincronia ----------
  const timeline = readyTrack?.timeline ?? null;
  const mapRef = React.useRef<{ lines: LyricLine[] | null; tl: PlaybackSyncItem[] | null; map: (number | null)[] }>({
    lines: null, tl: null, map: [],
  });
  const lastItemRef = React.useRef(-2);

  const lineMap = React.useCallback(() => {
    const lines = externalRef.current.getLines();
    const m = mapRef.current;
    if (m.lines !== lines || m.tl !== timeline) {
      mapRef.current = { lines, tl: timeline, map: timeline ? mapTimeline(timeline, lines) : [] };
      lastItemRef.current = -2; // reaplica a linha atual
    }
    return mapRef.current.map;
  }, [timeline]);

  const applyAt = React.useCallback((t: number) => {
    if (!timeline) return;
    const map = lineMap();
    let k = -1;
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].t <= t + LEAD_S) k = i; else break;
    }
    if (k === lastItemRef.current) return;
    lastItemRef.current = k;
    const line = k >= 0 ? map[k] : null;
    let upcoming: number | null = null;
    if (line == null) {
      for (let i = k + 1; i < map.length; i++) if (map[i] != null) { upcoming = map[i]; break; }
    }
    externalRef.current.follow(line, upcoming);
  }, [timeline, lineMap]);

  React.useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      const a = audioRef.current;
      if (a) applyAt(a.currentTime);
      raf = requestAnimationFrame(loop);
    };
    lastItemRef.current = -2;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, applyAt]);

  // Toque numa linha: pula para a próxima vez que ela toca (ou a primeira).
  React.useEffect(() => {
    const ref = external.onLineClickRef;
    ref.current = (line: number) => {
      const a = audioRef.current;
      if (!a || !timeline) return;
      const map = lineMap();
      const times = timeline.map((it, i) => (map[i] === line ? it.t : null)).filter((x): x is number => x != null);
      if (!times.length) return;
      const now = a.currentTime;
      const next = times.find((x) => x > now + 1) ?? times[0];
      a.currentTime = Math.max(0, next - SEEK_PREROLL_S);
      lastItemRef.current = -2;
      a.play().catch(() => undefined);
    };
    return () => { ref.current = null; };
  }, [external.onLineClickRef, timeline, lineMap]);

  // Fim da faixa: próxima música do repertório (se ligado).
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => {
      if (autoNext && onNextRef.current) {
        continueRef.current = true;
        onNextRef.current();
      }
    };
    a.addEventListener('ended', onEnded);
    return () => a.removeEventListener('ended', onEnded);
  }, [autoNext]);

  // ---------- Ações ----------
  const togglePlay = React.useCallback(() => {
    const a = audioRef.current;
    if (!a || !readyTrack) return;
    setOpen(true);
    if (a.paused) a.play().catch(() => setAudioError('O navegador bloqueou o áudio. Toque de novo.'));
    else a.pause();
  }, [readyTrack]);

  const seek = React.useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(t, (a.duration || t) - 0.05));
    setTime(a.currentTime);
    lastItemRef.current = -2;
  }, []);

  const setRate = React.useCallback((r: number) => {
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const setAutoNext = React.useCallback((v: boolean) => {
    setAutoNextState(v);
    try { window.localStorage.setItem(AUTO_NEXT_KEY, v ? '1' : '0'); } catch { /* sem storage */ }
  }, []);

  const close = React.useCallback(() => {
    audioRef.current?.pause();
    setOpen(false);
  }, []);

  const toReview = timeline ? timeline.filter((it) => it.conf != null && it.conf < 0.6).length : 0;

  return {
    tracks,
    loaded,
    track,
    readyTrack,
    pick,
    open,
    setOpen,
    close,
    playing,
    togglePlay,
    time,
    duration: duration || readyTrack?.durationSec || 0,
    seek,
    rate,
    rates: RATES,
    setRate,
    autoNext,
    setAutoNext,
    canAutoNext: !!onNext,
    audioError,
    toReview,
  };
}

export type PlaybackSync = ReturnType<typeof usePlaybackSync>;
