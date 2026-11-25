/**
 * Playbacks (mp3 sincronizado com a cifra): Firestore `playbacks/{id}` + Storage `playbacks/{uid}/{id}.{ext}`.
 * A sincronia é feita pela Cloud Function `analyze_playback` quando o arquivo termina de subir.
 */
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { database, getAppFunctions, getAppStorage } from '../../../firebaseConfig';
import type { PlaybackType } from '../../types/playbackType';

const COL = 'playbacks';
export const MAX_PLAYBACK_BYTES = 30 * 1024 * 1024;
const FUNCTIONS_REGION = 'us-central1';

/** Acompanha (ao vivo) os playbacks do usuário para uma música. Devolve a função que para de ouvir. */
export function watchPlaybacks(
  lyricId: string,
  uid: string,
  onChange: (list: PlaybackType[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(collection(database, COL), where('userId', '==', uid), where('lyricId', '==', lyricId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as PlaybackType), id: d.id }));
      const ms = (p: PlaybackType) => (p.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? Date.now();
      list.sort((a, b) => ms(a) - ms(b));
      onChange(list);
    },
    (e) => onError?.(e),
  );
}

export type UploadHandle = {
  id: string;
  /** Resolve quando o arquivo termina de subir (a análise continua na Function). */
  done: Promise<void>;
  cancel: () => void;
};

/** Cria o playback e envia o arquivo. `onProgress` recebe 0..1. */
export async function uploadPlayback(opts: {
  lyricId: string;
  uid: string;
  file: File;
  label: string;
  onProgress?: (fraction: number) => void;
}): Promise<UploadHandle> {
  const { lyricId, uid, file, label, onProgress } = opts;
  if (file.size > MAX_PLAYBACK_BYTES) throw new Error('O arquivo passa de 30 MB.');
  if (file.type && !file.type.startsWith('audio/')) throw new Error('Escolha um arquivo de áudio (mp3, m4a, wav).');

  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
  const ref = doc(collection(database, COL));
  const storagePath = `playbacks/${uid}/${ref.id}.${ext}`;
  const data: PlaybackType = {
    lyricId,
    userId: uid,
    label: label.trim() || file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    storagePath,
    status: 'uploading',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  const { ref: sref, uploadBytesResumable } = await import('firebase/storage');
  const storage = await getAppStorage();
  const task = uploadBytesResumable(sref(storage, storagePath), file, {
    contentType: file.type || 'audio/mpeg',
  });
  const done = new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      async (err) => {
        await deleteDoc(ref).catch(() => undefined);
        reject(err.code === 'storage/canceled' ? new Error('Envio cancelado.') : err);
      },
      () => resolve(),
    );
  });
  return { id: ref.id, done, cancel: () => task.cancel() };
}

export async function renamePlayback(id: string, label: string) {
  await updateDoc(doc(database, COL, id), { label: label.trim(), updatedAt: serverTimestamp() });
}

/** Apaga o arquivo e o registro (a análise guardada é apagada pela Function). */
export async function deletePlayback(p: PlaybackType) {
  if (!p.id) return;
  try {
    const { ref: sref, deleteObject } = await import('firebase/storage');
    await deleteObject(sref(await getAppStorage(), p.storagePath));
  } catch (e) {
    if ((e as { code?: string }).code !== 'storage/object-not-found') throw e;
  }
  await deleteDoc(doc(database, COL, p.id));
}

const urlCache = new Map<string, string>();
export async function playbackUrl(storagePath: string): Promise<string> {
  const hit = urlCache.get(storagePath);
  if (hit) return hit;
  const { ref: sref, getDownloadURL } = await import('firebase/storage');
  const url = await getDownloadURL(sref(await getAppStorage(), storagePath));
  urlCache.set(storagePath, url);
  return url;
}

/** Refaz só o alinhamento (sem reprocessar o áudio), usando a cifra atual da música. */
export async function resyncPlayback(id: string) {
  const { httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<{ playbackId: string }, { ok: boolean }>(
    await getAppFunctions(FUNCTIONS_REGION),
    'resync_playback',
  );
  await call({ playbackId: id });
}

/** Pede a separação de instrumentos (roda em segundo plano; o progresso chega pelo `watchPlaybacks`). */
export async function requestStems(id: string) {
  const { httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<{ playbackId: string }, { ok: boolean; status: string }>(
    await getAppFunctions(FUNCTIONS_REGION),
    'separate_stems',
  );
  return (await call({ playbackId: id })).data;
}

/** Separação parada há muito tempo (o worker morreu): o app deixa pedir de novo. */
export const STEMS_STALE_MS = 20 * 60 * 1000;
export function stemsStale(p: PlaybackType): boolean {
  const s = p.stems;
  if (!s || (s.status !== 'queued' && s.status !== 'processing')) return false;
  const ms = (s.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  return ms != null && Date.now() - ms > STEMS_STALE_MS;
}

/** Faixas ligadas/desligadas/solo de cada playback (no aparelho). */
export type StemMix = Record<string, { on: boolean; solo: boolean }>;
const mixKey = (playbackId: string) => `playback:stems:${playbackId}`;
export function loadStemPrefs(playbackId: string): { mix: StemMix; useStems: boolean } | null {
  try {
    const raw = window.localStorage.getItem(mixKey(playbackId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveStemPrefs(playbackId: string, prefs: { mix: StemMix; useStems: boolean }) {
  try { window.localStorage.setItem(mixKey(playbackId), JSON.stringify(prefs)); } catch { /* sem storage */ }
}

/** Mesmo hash que a Function grava em `cifraHash` (sha1 do HTML da cifra). */
export async function cifraHash(html: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(html));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Último playback escolhido para a música (no aparelho). */
const pickKey = (lyricId: string) => `playback:pick:${lyricId}`;
export function loadPickedPlayback(lyricId: string): string | null {
  try { return window.localStorage.getItem(pickKey(lyricId)); } catch { return null; }
}
export function savePickedPlayback(lyricId: string, id: string | null) {
  try {
    if (id) window.localStorage.setItem(pickKey(lyricId), id);
    else window.localStorage.removeItem(pickKey(lyricId));
  } catch { /* sem storage */ }
}
