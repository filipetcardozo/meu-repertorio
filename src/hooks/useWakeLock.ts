import React from 'react';

/** Mantém a tela do celular acesa enquanto `active` (quando o navegador permite). */
export function useWakeLock(active: boolean) {
  React.useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) l.release().catch(() => { });
        else lock = l;
      } catch { }
    };

    const onVisibility = () => { request(); };
    request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release().catch(() => { });
    };
  }, [active]);
}
