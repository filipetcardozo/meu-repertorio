import React from 'react';

/**
 * Arrastar para o lado (no celular) troca de música: para a esquerda vai para a próxima,
 * para a direita volta para a anterior. O conteúdo acompanha o dedo e, ao soltar, sai pela
 * lateral (ou volta para o lugar, se o gesto foi curto).
 *
 * Os eventos ficam no documento, então o gesto funciona em qualquer lugar da área da música,
 * inclusive no espaço vazio abaixo dela. `isExcluded` deixa de fora barras, controles e diálogos.
 */

type Options = {
  enabled: boolean;
  /** Elemento que acompanha o dedo (só ele é movido; nada "fixed" pode estar dentro dele). */
  getContent: () => HTMLElement | null;
  isExcluded: (target: Element) => boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

type Gesture = {
  x: number;
  y: number;
  t: number;
  dx: number;
  lock: 'x' | 'y' | 'none' | null;
  content: HTMLElement | null;
  scroller: HTMLElement | null;
};

/** Distância (px) antes de decidir se o gesto é horizontal ou vertical. */
const SLOP = 10;
/** O gesto precisa ser claramente mais horizontal que vertical. */
const HORIZONTAL_RATIO = 1.3;
const OUT_MS = 160;
const BACK_MS = 200;

function clearStyles(el: HTMLElement | null) {
  if (!el) return;
  el.style.transition = '';
  el.style.transform = '';
  el.style.opacity = '';
  el.style.willChange = '';
}

/** Sobra lateral (px) abaixo da qual a rolagem do `pre` é ignorada (arredondamento, um espaço a mais...). */
const MIN_SCROLL_OVERFLOW = 12;

/** `pre` com rolagem horizontal de verdade que ainda pode rolar no sentido do gesto. */
function canScrollX(el: HTMLElement | null, dx: number) {
  if (!el || el.scrollWidth - el.clientWidth <= MIN_SCROLL_OVERFLOW) return false;
  return dx < 0 ? el.scrollLeft < el.scrollWidth - el.clientWidth - 1 : el.scrollLeft > 0;
}

export function useSwipeNavigation(options: Options) {
  const { enabled } = options;
  const getOptions = React.useEffectEvent(() => options);
  // Sentido da última troca feita por gesto (1 = próxima, -1 = anterior), para animar a entrada.
  const directionRef = React.useRef<0 | 1 | -1>(0);

  React.useEffect(() => {
    if (!enabled) return;

    let g: Gesture | null = null;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const springBack = (content: HTMLElement | null) => {
      if (!content) return;
      content.style.transition = `transform ${BACK_MS}ms ease, opacity ${BACK_MS}ms ease`;
      content.style.transform = '';
      content.style.opacity = '';
      clearTimeout(timer);
      timer = setTimeout(() => clearStyles(content), BACK_MS + 20);
    };

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) {
        if (g?.lock === 'x') springBack(g.content);
        g = null;
        return;
      }
      const target = e.target as Element | null;
      if (!target || getOptions().isExcluded(target)) {
        g = null;
        return;
      }
      const touch = e.touches[0];
      g = {
        x: touch.clientX,
        y: touch.clientY,
        t: performance.now(),
        dx: 0,
        lock: null,
        content: getOptions().getContent(),
        scroller: target.closest('pre') as HTMLElement | null,
      };
    };

    const onMove = (e: TouchEvent) => {
      if (!g || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - g.x;
      const dy = touch.clientY - g.y;

      if (g.lock === null) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO) {
          g.lock = canScrollX(g.scroller, dx) ? 'none' : 'x';
        } else {
          g.lock = 'y';
        }
        if (g.lock === 'x' && g.content) {
          g.content.style.transition = 'none';
          g.content.style.willChange = 'transform, opacity';
        }
      }
      if (g.lock !== 'x') return;

      // Gesto horizontal: a página não rola enquanto o dedo arrasta a música para o lado.
      if (e.cancelable) e.preventDefault();
      g.dx = dx;
      if (!g.content) return;
      const { canPrev, canNext } = getOptions();
      const blocked = (dx < 0 && !canNext) || (dx > 0 && !canPrev);
      // Sem música para aquele lado: só um "elástico" curto.
      const offset = blocked ? dx * 0.2 : dx;
      const width = window.innerWidth || 1;
      g.content.style.transform = `translate3d(${offset}px, 0, 0)`;
      g.content.style.opacity = String(1 - Math.min(1, Math.abs(offset) / width) * 0.5);
    };

    const onEnd = () => {
      const cur = g;
      g = null;
      if (!cur || cur.lock !== 'x') return;

      const { canPrev, canNext } = getOptions();
      const dx = cur.dx;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const allowed = dir === 1 ? canNext : canPrev;
      const width = window.innerWidth || 1;
      const velocity = Math.abs(dx) / Math.max(1, performance.now() - cur.t); // px/ms
      const far = Math.abs(dx) > Math.min(120, width * 0.28);
      const flick = Math.abs(dx) > 50 && velocity > 0.5;

      if (!allowed || !(far || flick)) {
        springBack(cur.content);
        return;
      }

      busy = true;
      const content = cur.content;
      if (content) {
        content.style.transition = `transform ${OUT_MS}ms ease-in, opacity ${OUT_MS}ms ease-in`;
        content.style.transform = `translate3d(${-dir * width}px, 0, 0)`;
        content.style.opacity = '0';
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        directionRef.current = dir;
        const opts = getOptions();
        if (dir === 1) opts.onNext();
        else opts.onPrev();
        // Se a troca não aconteceu (ou ninguém animou a entrada), devolve a música ao lugar.
        timer = setTimeout(() => {
          busy = false;
          if (directionRef.current !== 0) {
            directionRef.current = 0;
            clearStyles(content);
          }
        }, 120);
      }, content ? OUT_MS : 0);
    };

    const onCancel = () => {
      if (g?.lock === 'x') springBack(g.content);
      g = null;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      if (g?.lock === 'x') clearStyles(g.content);
      g = null;
    };
  }, [enabled]);

  /** Lê (e zera) o sentido da última troca feita por gesto. */
  const takeSwipeDirection = React.useCallback(() => {
    const d = directionRef.current;
    directionRef.current = 0;
    return d;
  }, []);

  return { takeSwipeDirection };
}
