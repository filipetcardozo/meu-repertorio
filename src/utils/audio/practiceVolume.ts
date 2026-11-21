/**
 * Volume dos sons do app (acordes e "dar o tom"), de 0 a 1, salvo no aparelho.
 * O ganho aplicado é v² para o controle soar natural (o ouvido percebe volume em escala logarítmica).
 */

const KEY = 'practice-volume';
const DEFAULT = 0.6;

let volume: number | null = null;
const listeners = new Set<() => void>();

export function getPracticeVolume(): number {
  if (volume == null) {
    volume = DEFAULT;
    try {
      const v = Number(window.localStorage.getItem(KEY));
      if (window.localStorage.getItem(KEY) != null && v >= 0 && v <= 1) volume = v;
    } catch { }
  }
  return volume;
}

export function setPracticeVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  try { window.localStorage.setItem(KEY, String(volume)); } catch { }
  listeners.forEach((l) => l());
}

export function subscribePracticeVolume(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Ganho correspondente ao volume atual. */
export const practiceGain = () => getPracticeVolume() ** 2;

/** Liga um GainNode ao volume do app (atualiza quando o usuário mexe no controle). */
export function bindVolume(node: GainNode, ctx: BaseAudioContext, scale = 1) {
  node.gain.value = practiceGain() * scale;
  subscribePracticeVolume(() => node.gain.setTargetAtTime(practiceGain() * scale, ctx.currentTime, 0.02));
}
