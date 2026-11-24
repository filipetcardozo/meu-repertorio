import React from 'react';
import {
  buildTokens, decide, initialFollowState, MAX_HEARD_WORDS, tokenize, type FollowState, type Token,
} from '../utils/lyricFollow/aligner';
import { extractLyricLines, lineRect, type LyricLine } from '../utils/lyricFollow/domLines';
import { findScrollParent, ScrollEngine, scrollTopOf, viewportOf } from '../utils/lyricFollow/scrollEngine';
import { useSpeechRecognition, useSpeechSupported } from './useSpeechRecognition';
import { useWakeLock } from './useWakeLock';
import { requestHideBars } from './useHideOnScroll';

/**
 * Modo show: rolagem automática (com velocidade ajustável e salva por música)
 * e "seguir a voz" (opcional), que destaca a linha cantada e ajusta a rolagem.
 *
 * Com os dois ligados, a voz corrige a rolagem automática:
 *  - mede o ritmo real (px/s entre as linhas cantadas) e aproxima a velocidade desse ritmo;
 *  - se a linha cantada está abaixo do ponto ideal, acelera; se está acima, desacelera;
 *  - se a rolagem passou muito do cantor, ela espera; se ficou muito para trás, dá um ajuste suave.
 */

export const SPEED_DEFAULT = 28; // px/s ≈ "1.0x"
const SPEED_MIN = 6;
const SPEED_MAX = 220;
const SPEED_STEP = 1.2;
/** Onde a linha cantada deve ficar (fração da altura visível). */
const ANCHOR = 0.35;
/** Faixa confortável: dentro dela não reposicionamos (evita tremedeira). */
const BAND_TOP = 0.14;
const BAND_BOTTOM = 0.6;
/** Por quanto tempo uma linha reconhecida "vale" para segurar a rolagem. */
const MATCH_FRESH_MS = 20000;

const speedKey = (k: string) => `autoscroll-speed:${k}`;
const LAST_SPEED_KEY = 'autoscroll-speed:last';

function loadSpeed(lyricKey: string): number {
  try {
    const v = Number(window.localStorage.getItem(speedKey(lyricKey)) ?? window.localStorage.getItem(LAST_SPEED_KEY));
    if (v >= SPEED_MIN && v <= SPEED_MAX) return v;
  } catch { }
  return SPEED_DEFAULT;
}

const clampSpeed = (v: number) => Math.min(SPEED_MAX, Math.max(SPEED_MIN, v));

export type HighlightBox = { top: number; height: number; left: number; width: number };

export function useLyricFollow(lyricKey: string) {
  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  // O motor vive num ref (é mutável e não participa da renderização).
  const engineRef = React.useRef<ScrollEngine | null>(null);
  const getEngine = React.useCallback(() => (engineRef.current ??= new ScrollEngine()), []);

  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(SPEED_DEFAULT);
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [heard, setHeard] = React.useState('');
  const [currentLine, setCurrentLine] = React.useState<number | null>(null);
  const [highlight, setHighlight] = React.useState<HighlightBox | null>(null);
  const voiceSupported = useSpeechSupported();
  // Playback sincronizado: o áudio diz qual é a linha (no lugar da voz).
  const [externalActive, setExternalActive] = React.useState(false);
  const externalActiveRef = React.useRef(false);
  const externalClickRef = React.useRef<((line: number) => void) | null>(null);

  // Troca de música: carrega a velocidade dessa música e zera a posição.
  // A rolagem automática e a voz continuam como estavam (no repertório, a próxima música segue no mesmo modo).
  const [prevKey, setPrevKey] = React.useState<string | null>(null);
  if (prevKey !== lyricKey) {
    setPrevKey(lyricKey);
    setSpeed(typeof window === 'undefined' ? SPEED_DEFAULT : loadSpeed(lyricKey));
    setCurrentLine(null);
    setHighlight(null);
    setHeard('');
  }

  // Estado mutável do motor (não precisa re-renderizar).
  const linesRef = React.useRef<LyricLine[]>([]);
  const tokensRef = React.useRef<Token[]>([]);
  const followRef = React.useRef<FollowState>(initialFollowState());
  const heardWordsRef = React.useRef<string[]>([]);
  const heardRawRef = React.useRef('');
  const currentLineRef = React.useRef<number | null>(null);
  const lastMatchAtRef = React.useRef(0);
  const historyRef = React.useRef<{ t: number; y: number }[]>([]);
  const voiceEnabledRef = React.useRef(false);
  const speedRef = React.useRef(speed);

  React.useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  React.useEffect(() => { speedRef.current = speed; getEngine().speed = speed; }, [speed, getEngine]);
  React.useEffect(() => { getEngine().setPlaying(playing); }, [playing, getEngine]);
  // Ao dar play, recolhe as barras do topo (no celular) para sobrar tela para a cifra.
  React.useEffect(() => { if (playing) requestHideBars(); }, [playing]);
  React.useEffect(() => () => getEngine().destroy(), [getEngine]);

  // Salva a velocidade da música (com um pequeno atraso: a voz ajusta várias vezes seguidas).
  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(speedKey(lyricKey), String(Math.round(speed)));
        window.localStorage.setItem(LAST_SPEED_KEY, String(Math.round(speed)));
      } catch { }
    }, 800);
    return () => clearTimeout(t);
  }, [speed, lyricKey]);

  // Zera o seguimento quando a música muda.
  React.useEffect(() => {
    followRef.current = initialFollowState();
    heardWordsRef.current = [];
    heardRawRef.current = '';
    currentLineRef.current = null;
    historyRef.current = [];
    lastMatchAtRef.current = 0;
    // Se a rolagem seguir ligada, dá um respiro no começo da música nova antes de voltar a rolar.
    getEngine().userInteracted(1500);
  }, [lyricKey, getEngine]);

  // ---------- Medidas ----------

  const scrollTarget = React.useCallback(() => findScrollParent(root), [root]);

  const updateHighlight = React.useCallback(() => {
    const idx = currentLineRef.current;
    const line = idx == null ? null : linesRef.current[idx];
    if (!root || !line) return setHighlight(null);
    const r = lineRect(line);
    if (!r) return setHighlight(null);
    const rootBox = root.getBoundingClientRect();
    const c = line.container.getBoundingClientRect();
    setHighlight({ top: r.top - rootBox.top - 2, height: r.bottom - r.top + 4, left: c.left - rootBox.left - 6, width: c.width + 12 });
  }, [root]);

  /** Posição da linha na área visível do alvo de rolagem. */
  const measureLine = React.useCallback((idx: number) => {
    const line = linesRef.current[idx];
    const r = line && lineRect(line);
    if (!r) return null;
    const target = scrollTarget();
    const vp = viewportOf(target);
    return { target, vp, y: r.top - vp.top, docY: r.top - vp.top + scrollTopOf(target) };
  }, [scrollTarget]);

  // Relê as linhas sempre que a cifra muda na tela (troca de tom, fonte, quebra de linha...).
  React.useEffect(() => {
    if (!root) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const rescan = () => {
      const lines = extractLyricLines(root);
      linesRef.current = lines;
      tokensRef.current = buildTokens(lines);
      const tokens = tokensRef.current;
      const st = followRef.current;
      if (st.cursor >= tokens.length) followRef.current = { ...st, cursor: tokens.length - 1 };
      const cur = followRef.current.cursor;
      if (externalActiveRef.current) {
        // playback: a linha vem do áudio; só garante que ainda existe
        if (currentLineRef.current != null && currentLineRef.current >= lines.length) currentLineRef.current = null;
      } else if (currentLineRef.current != null) {
        currentLineRef.current = cur >= 0 ? tokens[cur].line : null;
        setCurrentLine(currentLineRef.current);
      }
      updateHighlight();
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(rescan, 60);
    };
    rescan();
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    return () => {
      clearTimeout(timer);
      mo.disconnect();
      ro.disconnect();
    };
  }, [root, updateHighlight]);

  // ---------- Rolagem ----------

  React.useEffect(() => {
    const engine = getEngine();
    engine.getTarget = scrollTarget;
    // Se a rolagem passou do cantor (linha cantada saiu por cima), espera ele alcançar.
    engine.shouldHold = () => {
      const idx = currentLineRef.current;
      if (!voiceEnabledRef.current || idx == null) return false;
      if (performance.now() - lastMatchAtRef.current > MATCH_FRESH_MS) return false;
      const m = measureLine(idx);
      return !!m && m.y < m.vp.height * BAND_TOP;
    };
  }, [getEngine, scrollTarget, measureLine]);

  // Toque/roda do mouse do usuário: pausa a rolagem um instante em vez de brigar com ele.
  React.useEffect(() => {
    const engine = getEngine();
    const isControl = (e: Event) => !!(e.target as Element | null)?.closest?.('[data-follow-controls]');
    const onWheel = () => engine.userInteracted();
    const onTouchStart = (e: TouchEvent) => { if (!isControl(e)) engine.setTouching(true); };
    const onTouchEnd = (e: TouchEvent) => { if (!isControl(e)) engine.setTouching(false); };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) engine.userInteracted();
    };
    // Captura também o scroll de elementos (scroll não sobe na árvore, mas passa pela captura).
    const onScroll = () => engine.noteScroll();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [getEngine]);

  /** Chamado quando a linha cantada muda: posiciona a tela e (com rolagem ligada) ajusta a velocidade. */
  const onLineChanged = React.useCallback((line: number, prev: number | null, manual: boolean) => {
    const engine = getEngine();
    currentLineRef.current = line;
    setCurrentLine(line);
    updateHighlight();

    const m = measureLine(line);
    if (!m) return;
    const now = performance.now();
    const anchorY = m.vp.height * ANCHOR;
    const error = m.y - anchorY;
    const outOfBand = m.y < m.vp.height * BAND_TOP || m.y > m.vp.height * BAND_BOTTOM;

    const forward = prev != null && line > prev && !manual;
    if (!forward) historyRef.current = [];
    historyRef.current = [...historyRef.current, { t: now, y: m.docY }].filter((h) => now - h.t < 30000).slice(-8);

    if (manual) {
      if (outOfBand) engine.correct(error);
      return;
    }
    if (engine.isUserActive()) return;

    if (!engine.playing) {
      if (outOfBand) engine.correct(error);
      return;
    }

    // Rolagem ligada: aproxima a velocidade do ritmo do cantor e corrige a diferença aos poucos.
    if (Math.abs(error) > m.vp.height * 0.4) engine.correct(error);
    if (!forward) return;
    const h = historyRef.current;
    const span = h.length >= 3 ? (h[h.length - 1].t - h[0].t) / 1000 : 0;
    const rate = span >= 4 ? (h[h.length - 1].y - h[0].y) / span : null;
    const base = rate != null && rate > 0 ? rate : speedRef.current;
    const target = base + error / 5;
    setSpeed(clampSpeed(speedRef.current * 0.5 + target * 0.5));
  }, [getEngine, measureLine, updateHighlight]);

  // ---------- Voz ----------

  const handleSpeech = React.useCallback((finalText: string, interimText: string) => {
    if (finalText) {
      heardWordsRef.current = [...heardWordsRef.current, ...tokenize(finalText)].slice(-12);
      heardRawRef.current = (heardRawRef.current + ' ' + finalText).slice(-120);
    }
    const raw = (heardRawRef.current + ' ' + interimText).trim();
    setHeard(raw.split(/\s+/).slice(-7).join(' '));

    const tokens = tokensRef.current;
    const words = [...heardWordsRef.current, ...tokenize(interimText)].slice(-MAX_HEARD_WORDS);
    const next = decide(words, tokens, followRef.current, !!finalText);
    const moved = next.cursor !== followRef.current.cursor;
    followRef.current = { cursor: next.cursor, pendingJump: next.pendingJump };
    if (!moved || next.cursor < 0) return;

    lastMatchAtRef.current = performance.now();
    const line = tokens[next.cursor].line;
    const prev = currentLineRef.current;
    if (line !== prev) onLineChanged(line, prev, false);
  }, [onLineChanged]);

  const handleFatal = React.useCallback((message: string) => {
    setVoiceError(message);
    setVoiceEnabled(false);
  }, []);

  const { status: voiceStatus } = useSpeechRecognition({
    enabled: voiceEnabled,
    onResult: handleSpeech,
    onFatalError: handleFatal,
  });

  useWakeLock(playing || voiceEnabled);

  // Ferramenta de desenvolvimento: simula o que foi cantado (window.__lyricFollowFeed('texto', true)).
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as { __lyricFollowFeed?: (t: string, final?: boolean) => void };
    w.__lyricFollowFeed = (t, final = true) => (final ? handleSpeech(t, '') : handleSpeech('', t));
    return () => { delete w.__lyricFollowFeed; };
  }, [handleSpeech]);

  // ---------- Ações da interface ----------

  const toggleVoice = React.useCallback(() => {
    const turningOn = !voiceEnabledRef.current;
    voiceEnabledRef.current = turningOn;
    setVoiceError(null);
    setVoiceEnabled(turningOn);
    heardWordsRef.current = [];
    heardRawRef.current = '';
    setHeard('');
    if (!turningOn) {
      currentLineRef.current = null;
      setCurrentLine(null);
      setHighlight(null);
    }
  }, []);

  const togglePlaying = React.useCallback(() => setPlaying((p) => !p), []);
  const faster = React.useCallback(() => setSpeed((s) => clampSpeed(s * SPEED_STEP)), []);
  const slower = React.useCallback(() => setSpeed((s) => clampSpeed(s / SPEED_STEP)), []);

  // ---------- Playback sincronizado ----------

  const activateExternal = React.useCallback((on: boolean) => {
    externalActiveRef.current = on;
    setExternalActive(on);
    if (on) {
      setPlaying(false); // a rolagem passa a seguir o áudio
    } else if (!voiceEnabledRef.current) {
      currentLineRef.current = null;
      setCurrentLine(null);
      setHighlight(null);
    }
  }, []);

  /**
   * O áudio chegou numa linha: destaca e põe na altura de leitura.
   * `line` null = trecho sem letra (introdução, solo): sem destaque, mas já mostra `upcoming`.
   */
  const followExternal = React.useCallback((line: number | null, upcoming: number | null = null) => {
    const engine = getEngine();
    currentLineRef.current = line;
    setCurrentLine(line);
    updateHighlight();
    const target = line ?? upcoming;
    if (target == null || engine.isUserActive()) return;
    const m = measureLine(target);
    if (!m) return;
    const error = m.y - m.vp.height * ANCHOR;
    if (Math.abs(error) > m.vp.height * 0.04) engine.correct(error);
  }, [getEngine, measureLine, updateHighlight]);

  const getLines = React.useCallback(() => linesRef.current, []);

  /** Toque numa linha (com a voz ligada): "estou aqui". Com playback: pula o áudio para ela. */
  const handleLyricClick = React.useCallback((e: React.MouseEvent) => {
    if (!voiceEnabledRef.current && !externalActiveRef.current) return;
    const body = (e.target as Element).closest('[data-lyric-body]');
    if (!body) return;
    const lines = linesRef.current;
    let pick = -1;
    let bestDist = 28;
    lines.forEach((l, i) => {
      if (l.container !== body) return;
      const r = lineRect(l);
      if (!r) return;
      const dist = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
      if (dist < bestDist) { bestDist = dist; pick = i; }
    });
    if (pick < 0) return;
    if (externalActiveRef.current) {
      externalClickRef.current?.(pick);
      return;
    }
    const first = tokensRef.current.findIndex((t) => t.line === pick);
    followRef.current = { cursor: first, pendingJump: null };
    heardWordsRef.current = [];
    lastMatchAtRef.current = performance.now();
    onLineChanged(pick, currentLineRef.current, true);
  }, [onLineChanged]);

  return {
    rootRef: setRoot,
    root,
    playing,
    togglePlaying,
    speed,
    speedLabel: `${(speed / SPEED_DEFAULT).toFixed(1)}x`,
    faster,
    slower,
    voice: {
      supported: voiceSupported,
      enabled: voiceEnabled,
      listening: voiceStatus === 'listening',
      error: voiceError,
      heard,
      toggle: toggleVoice,
    },
    currentLine,
    highlight: voiceEnabled || externalActive ? highlight : null,
    handleLyricClick,
    external: {
      active: externalActive,
      activate: activateExternal,
      follow: followExternal,
      getLines,
      onLineClickRef: externalClickRef,
    },
  };
}
