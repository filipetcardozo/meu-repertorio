import { getAuth } from 'firebase/auth';

export type MergeResult = { lyric: string; tone: string; notes: string[]; audioShift: number; remaining: number };

// O servidor diz uma vez se a IA está configurada; sem ela o botão "Juntar com IA" nem aparece.
let enabledPromise: Promise<boolean> | null = null;
export const mergeAiEnabled = () =>
  (enabledPromise ??= fetch('/api/ai/merge-cifra')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d) => !!d.enabled)
    .catch(() => false));

/** Junta a cifra de referência, a letra e a cifra gerada pelo áudio (ver src/lib/ai/mergeCifra.ts). */
export async function mergeCifraWithAi(body: {
  reference: string;
  referenceTone?: string;
  audio: string;
  audioTone?: string;
  lyrics?: string;
  lyricName?: string;
  composerName?: string;
}, signal?: AbortSignal): Promise<MergeResult> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Entre na sua conta para usar a IA.');
  const res = await fetch('/api/ai/merge-cifra', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível juntar as cifras.');
  return data as MergeResult;
}
