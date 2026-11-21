/**
 * Motor de rolagem: rolagem contínua (velocidade em px/s) + correções suaves de posição.
 * Funciona tanto com a janela quanto com um elemento com overflow (desktop do repertório).
 */

export function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el = start?.parentElement ?? null;
  while (el && el !== document.body && el !== document.documentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null; // janela
}

let insetCache = { at: 0, value: 0 };

/** Altura das barras fixas/grudadas no topo da janela (AppBar, barra do repertório...). */
function windowTopInset(): number {
  const now = performance.now();
  if (now - insetCache.at < 500) return insetCache.value;
  let y = 1;
  for (let guard = 0; guard < 4; guard++) {
    let bottom = 0;
    for (let el = document.elementFromPoint(window.innerWidth / 2, y); el && el !== document.body; el = el.parentElement) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        bottom = el.getBoundingClientRect().bottom;
        break;
      }
    }
    if (bottom <= y) break;
    y = bottom + 1;
  }
  const value = Math.min(y - 1, window.innerHeight * 0.4);
  insetCache = { at: now, value };
  return value;
}

export function viewportOf(el: HTMLElement | null): { top: number; height: number } {
  if (!el) {
    const top = windowTopInset();
    return { top, height: window.innerHeight - top };
  }
  const r = el.getBoundingClientRect();
  const top = Math.max(0, r.top);
  return { top, height: Math.max(1, Math.min(r.bottom, window.innerHeight) - top) };
}

export function scrollTopOf(el: HTMLElement | null): number {
  return el ? el.scrollTop : window.scrollY;
}

function scrollRoom(el: HTMLElement | null): { up: number; down: number } {
  const top = scrollTopOf(el);
  const max = el ? el.scrollHeight - el.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
  return { up: top, down: Math.max(0, max - top) };
}

function scrollByPx(el: HTMLElement | null, dy: number) {
  if (el) el.scrollTo({ top: el.scrollTop + dy, behavior: 'instant' });
  else window.scrollTo({ top: window.scrollY + dy, behavior: 'instant' });
}

/** Pausa depois que o usuário solta a tela / para a roda do mouse, antes de retomar a rolagem. */
const RESUME_AFTER_MS = 600;
/** Enquanto a página ainda desliza sozinha (inércia do toque), estende a pausa por este tempo a cada movimento. */
const MOMENTUM_GRACE_MS = 250;

export class ScrollEngine {
  playing = false;
  /** px por segundo */
  speed = 28;
  /** Alvo da rolagem (null = janela). */
  getTarget: () => HTMLElement | null = () => null;
  /** Quando true, a rolagem contínua espera (ex.: o cantor ficou para trás). */
  shouldHold: () => boolean = () => false;

  private raf = 0;
  private last = 0;
  private acc = 0;
  private correction = 0;
  private holdUntil = 0;
  private touching = false;
  /** Posição em que a nossa última rolagem deixou o alvo (para separar a nossa rolagem da do usuário). */
  private expectedTop: number | null = null;

  setPlaying(v: boolean) {
    this.playing = v;
    if (v) this.kick();
  }

  /** Rola `dy` px de forma suave (cancela correção anterior). */
  correct(dy: number) {
    const room = scrollRoom(this.getTarget());
    this.correction = Math.max(-room.up, Math.min(room.down, dy));
    if (Math.abs(this.correction) >= 1) this.kick();
    else this.correction = 0;
  }

  /** O usuário mexeu na tela: não brigamos com ele por um tempo. */
  userInteracted(ms = RESUME_AFTER_MS) {
    this.holdUntil = performance.now() + ms;
    this.correction = 0;
  }

  /**
   * Chamado a cada evento de scroll. Se a posição mudou sem ter sido a gente (inércia depois de
   * soltar o dedo, barra de rolagem arrastada...), segura a rolagem só enquanto esse movimento durar.
   */
  noteScroll() {
    if (!this.playing || this.touching) return;
    const top = scrollTopOf(this.getTarget());
    if (this.expectedTop != null && Math.abs(top - this.expectedTop) < 2) return;
    this.expectedTop = top;
    this.holdUntil = Math.max(this.holdUntil, performance.now() + MOMENTUM_GRACE_MS);
    this.correction = 0;
  }

  isUserActive() {
    return this.touching || performance.now() < this.holdUntil;
  }

  setTouching(v: boolean) {
    this.touching = v;
    if (v) this.correction = 0;
    else this.userInteracted();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playing = false;
    this.correction = 0;
  }

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    let dy = 0;
    if (!this.isUserActive()) {
      if (this.playing && !this.shouldHold()) dy += this.speed * dt;
      if (this.correction) {
        let step = this.correction * (1 - Math.exp(-dt / 0.2));
        if (Math.abs(this.correction - step) < 0.5) step = this.correction;
        this.correction -= step;
        dy += step;
      }
    }

    this.acc += dy;
    const whole = Math.trunc(this.acc);
    if (whole) {
      const target = this.getTarget();
      scrollByPx(target, whole);
      this.expectedTop = scrollTopOf(target);
      this.acc -= whole;
    }

    if (this.playing || this.correction) this.raf = requestAnimationFrame(this.tick);
  };
}
