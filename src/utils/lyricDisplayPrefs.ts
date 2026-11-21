/**
 * Preferências de exibição da cifra (tamanho da fonte e espaçamentos).
 * Celular/tablet e computador guardam cada um o seu: quem usa os dois costuma querer valores diferentes.
 * Ficam no perfil do usuário (Firestore) e numa cópia local, para abrir já certo antes do perfil carregar.
 */

export type DisplayDevice = 'mobile' | 'desktop';

export type DeviceDisplayPrefs = {
  /** Tamanho da fonte da cifra, em px. */
  fontSize: number;
  /** Altura da linha, proporcional à fonte (1 = linhas encostadas). */
  lineHeight: number;
  /** Espaço extra entre as letras, em em. Na fonte monoespaçada o acorde continua em cima da sílaba. */
  letterSpacing: number;
  /** Espaço entre as colunas lado a lado (computador), em px. */
  columnGap: number;
};

export type LyricDisplayPrefs = {
  mobile: DeviceDisplayPrefs;
  desktop: DeviceDisplayPrefs;
  /** Quando foi a última mudança (ms). A cópia mais nova vence entre a local e a do perfil. */
  updatedAt: number;
};

type Range = { min: number; max: number; step: number };

export const DISPLAY_LIMITS: Record<DisplayDevice, Record<keyof DeviceDisplayPrefs, Range>> = {
  mobile: {
    fontSize: { min: 10, max: 22, step: 1 },
    lineHeight: { min: 1, max: 2, step: 0.05 },
    letterSpacing: { min: 0, max: 0.2, step: 0.01 },
    columnGap: { min: 8, max: 80, step: 8 },
  },
  desktop: {
    fontSize: { min: 10, max: 26, step: 1 },
    lineHeight: { min: 1, max: 2, step: 0.05 },
    letterSpacing: { min: 0, max: 0.2, step: 0.01 },
    columnGap: { min: 8, max: 80, step: 8 },
  },
};

export const DEFAULT_DISPLAY_PREFS: Record<DisplayDevice, DeviceDisplayPrefs> = {
  // Um pouco maior e mais aberto para ler de longe no palco.
  mobile: { fontSize: 14, lineHeight: 1.35, letterSpacing: 0, columnGap: 24 },
  // Bem justo para caber mais linhas por coluna.
  desktop: { fontSize: 14, lineHeight: 1.1, letterSpacing: 0, columnGap: 24 },
};

const STORAGE_KEY = 'lyric-display-prefs';
// Versão antiga guardava só o tamanho da fonte, uma chave por tipo de aparelho.
const LEGACY_FONT_KEYS: Record<DisplayDevice, string> = {
  mobile: 'lyric-font-size-mobile',
  desktop: 'lyric-font-size-desktop',
};

/** Arredonda para o passo (evita 1.3500000000000003) e prende no intervalo. */
export function clampPref(device: DisplayDevice, key: keyof DeviceDisplayPrefs, value: number): number {
  const { min, max, step } = DISPLAY_LIMITS[device][key];
  if (!Number.isFinite(value)) return DEFAULT_DISPLAY_PREFS[device][key];
  const snapped = Math.round(value / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(4));
}

function normalizeDevice(device: DisplayDevice, raw: Partial<DeviceDisplayPrefs> | undefined): DeviceDisplayPrefs {
  const def = DEFAULT_DISPLAY_PREFS[device];
  const pick = (key: keyof DeviceDisplayPrefs) =>
    typeof raw?.[key] === 'number' ? clampPref(device, key, raw[key] as number) : def[key];
  return {
    fontSize: pick('fontSize'),
    lineHeight: pick('lineHeight'),
    letterSpacing: pick('letterSpacing'),
    columnGap: pick('columnGap'),
  };
}

/** Formato aceito na leitura: qualquer campo pode faltar (perfil antigo, cópia local de outra versão). */
export type StoredDisplayPrefs = {
  mobile?: Partial<DeviceDisplayPrefs>;
  desktop?: Partial<DeviceDisplayPrefs>;
  updatedAt?: number;
};

export function normalizeDisplayPrefs(raw: StoredDisplayPrefs | undefined | null): LyricDisplayPrefs {
  return {
    mobile: normalizeDevice('mobile', raw?.mobile),
    desktop: normalizeDevice('desktop', raw?.desktop),
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

export function readLocalDisplayPrefs(): LyricDisplayPrefs {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeDisplayPrefs(JSON.parse(stored));

    // Aproveita o tamanho de fonte que a pessoa já tinha ajustado.
    const legacy = (device: DisplayDevice) => {
      const v = Number(window.localStorage.getItem(LEGACY_FONT_KEYS[device]));
      return v > 0 ? { fontSize: v } : undefined;
    };
    return normalizeDisplayPrefs({ mobile: legacy('mobile'), desktop: legacy('desktop') });
  } catch {
    return normalizeDisplayPrefs(undefined);
  }
}

export function writeLocalDisplayPrefs(prefs: LyricDisplayPrefs) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { }
}

/** Fica com a cópia alterada por último. */
export function newerDisplayPrefs(a: LyricDisplayPrefs, b: LyricDisplayPrefs | undefined): LyricDisplayPrefs {
  return b && b.updatedAt > a.updatedAt ? b : a;
}
