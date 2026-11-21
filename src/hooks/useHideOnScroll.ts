import { useEffect, useState } from 'react';

const HIDE_BARS_EVENT = 'app:hide-bars';

/**
 * Pede para esconder as barras do topo agora, como se o usuário tivesse rolado para baixo
 * (ex.: ao ligar a rolagem automática). Elas voltam quando o usuário rolar para cima.
 */
export function requestHideBars() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HIDE_BARS_EVENT));
}

type Options = {
  /** Abaixo dessa posição (px) a barra sempre aparece. */
  threshold?: number;
  /** Quanto (px) é preciso rolar na mesma direção para mudar o estado. Evita "tremedeira". */
  tolerance?: number;
  enabled?: boolean;
};

/**
 * Retorna true quando o usuário rolou para baixo e false quando rolou para cima.
 *
 * Diferente do useScrollTrigger do MUI:
 * - exige uma distância mínima na mesma direção (tolerance), então pequenos ajustes de scroll
 *   (barra de endereço do navegador mobile aparecendo/sumindo, "bounce" do iOS) não alternam o estado;
 * - limita o scroll ao intervalo válido da página, ignorando o overscroll.
 */
export function useHideOnScroll({ threshold = 80, tolerance = 16, enabled = true }: Options = {}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let current = false;
    let anchorY = window.scrollY; // ponto de referência: maior Y enquanto escondido, menor Y enquanto visível
    let ticking = false;
    // Escondido por pedido (requestHideBars): ignora o "topo da página sempre mostra"
    // e só volta a mostrar quando o usuário rolar para cima.
    let forced = false;

    const currentY = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(Math.max(window.scrollY, 0), maxScroll);
    };

    const update = () => {
      ticking = false;
      const y = currentY();

      let next = current;
      if (y <= threshold && !forced) next = false;
      else if (!current && y > anchorY + tolerance) next = true;
      else if (current && y < anchorY - tolerance) next = false;

      if (next !== current) {
        current = next;
        anchorY = y;
        if (!next) forced = false;
        setHidden(next);
      } else if ((current && y > anchorY) || (!current && y < anchorY)) {
        anchorY = y;
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    const onHideRequest = () => {
      forced = true;
      current = true;
      anchorY = currentY();
      setHidden(true);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(HIDE_BARS_EVENT, onHideRequest);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener(HIDE_BARS_EVENT, onHideRequest);
      // Ao desabilitar (ex.: menu aberto), volta a mostrar; ao reabilitar começa visível.
      setHidden(false);
    };
  }, [enabled, threshold, tolerance]);

  return enabled && hidden;
}
