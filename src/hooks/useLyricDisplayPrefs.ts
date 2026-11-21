import React from 'react';
import { useAuth } from './useAuth';
import { saveLyricDisplayPrefs } from '../providers/user/services';
import {
  clampPref,
  DEFAULT_DISPLAY_PREFS,
  DeviceDisplayPrefs,
  DisplayDevice,
  LyricDisplayPrefs,
  newerDisplayPrefs,
  normalizeDisplayPrefs,
  readLocalDisplayPrefs,
  writeLocalDisplayPrefs,
} from '../utils/lyricDisplayPrefs';

export type DisplaySaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Espera a pessoa parar de mexer antes de gravar no perfil (o slider muda a cada pixel). */
const SAVE_DELAY_MS = 700;

/**
 * Preferências de exibição da cifra do aparelho atual (celular ou computador).
 * Lê a cópia local na hora e troca pela do perfil quando ela for mais nova (ajustada em outro aparelho).
 * Cada mudança vale na hora, vai para a cópia local e, logo depois, para o perfil.
 */
export function useLyricDisplayPrefs(device: DisplayDevice) {
  const { uid, userInfos } = useAuth();
  const [local, setLocal] = React.useState<LyricDisplayPrefs>(() =>
    typeof window === 'undefined' ? normalizeDisplayPrefs(undefined) : readLocalDisplayPrefs(),
  );
  const [status, setStatus] = React.useState<DisplaySaveStatus>('idle');

  const remoteRaw = userInfos?.lyricDisplay;
  const remote = React.useMemo(() => (remoteRaw ? normalizeDisplayPrefs(remoteRaw) : undefined), [remoteRaw]);
  const all = newerDisplayPrefs(local, remote);
  const prefs = all[device];

  // Gravação pendente: sai no fim da espera ou quando o componente desmonta (troca de música).
  const pending = React.useRef<{ timer: ReturnType<typeof setTimeout>; run: () => void } | null>(null);
  const flush = React.useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    p.run();
  }, []);
  React.useEffect(() => flush, [flush]);

  const commit = React.useCallback((next: LyricDisplayPrefs) => {
    setLocal(next);
    writeLocalDisplayPrefs(next);
    if (!uid) return;

    if (pending.current) clearTimeout(pending.current.timer);
    const run = () => {
      setStatus('saving');
      saveLyricDisplayPrefs(uid, next)
        .then(() => setStatus('saved'))
        .catch((e) => {
          console.warn('Não foi possível salvar as preferências da cifra no perfil', e);
          setStatus('error');
        });
    };
    pending.current = { timer: setTimeout(() => { pending.current = null; run(); }, SAVE_DELAY_MS), run };
  }, [uid]);

  const update = React.useCallback((patch: Partial<DeviceDisplayPrefs>) => {
    const current = all[device];
    const changed = { ...current };
    (Object.keys(patch) as (keyof DeviceDisplayPrefs)[]).forEach((key) => {
      changed[key] = clampPref(device, key, patch[key] as number);
    });
    if ((Object.keys(changed) as (keyof DeviceDisplayPrefs)[]).every((k) => changed[k] === current[k])) return;
    commit({ ...all, [device]: changed, updatedAt: Date.now() });
  }, [all, device, commit]);

  const reset = React.useCallback(() => {
    commit({ ...all, [device]: DEFAULT_DISPLAY_PREFS[device], updatedAt: Date.now() });
  }, [all, device, commit]);

  const isDefault = (Object.keys(prefs) as (keyof DeviceDisplayPrefs)[])
    .every((k) => prefs[k] === DEFAULT_DISPLAY_PREFS[device][k]);

  return { prefs, update, reset, isDefault, status, canSyncProfile: !!uid };
}
