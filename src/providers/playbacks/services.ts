/**
 * Playbacks (mp3 sincronizado com a cifra): Firestore `playbacks/{id}` + Storage `playbacks/{uid}/{id}.{ext}`.
 * A sincronia é feita pela Cloud Function `analyze_playback` quando o arquivo termina de subir.
 */
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { database, getAppFunctions, getAppStorage } from '../../../firebaseConfig';
import type { GenerateInput, ImportStem, PlaybackType } from '../../types/playbackType';
import { audioContentType, extOf, type StemFile } from '../../lib/stemsImport';

const COL = 'playbacks';
export const MAX_PLAYBACK_BYTES = 30 * 1024 * 1024;
/**
 * App de quem desenvolve rodando com NEXT_PUBLIC_LOCAL_WORKER=1 (`yarn dev:local`): os playbacks enviados
 * são processados no PC (worker/local_listener.py) em vez do Cloud Run. A Function só
 * aceita isso de conta admin; para as outras, a marca é ignorada.
 */
export const PROCESS_ON_PC = process.env.NEXT_PUBLIC_LOCAL_WORKER === '1';
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

/** Acompanha (ao vivo) um playback. Devolve a função que para de ouvir. */
export function watchPlayback(
  id: string,
  onChange: (p: PlaybackType | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(database, COL, id),
    (snap) => onChange(snap.exists() ? { ...(snap.data() as PlaybackType), id: snap.id } : null),
    (e) => onError?.(e),
  );
}

/**
 * Cria o playback e envia o arquivo. `onProgress` recebe 0..1.
 * `generate`: o processamento também gera a cifra pelo áudio (`generated`). `lyricId` vazio = música
 * ainda não salva (tela de adicionar música); ligue depois com `attachPlayback`.
 */
export async function uploadPlayback(opts: {
  lyricId: string;
  uid: string;
  file: File;
  label: string;
  generate?: boolean;
  /** Letra para a cifra gerada (sem ela, usa a letra reconhecida na voz). */
  generateInput?: GenerateInput | null;
  onProgress?: (fraction: number) => void;
}): Promise<UploadHandle> {
  const { lyricId, uid, file, label, generate, generateInput, onProgress } = opts;
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
    ...(generate ? { generate: true } : {}),
    ...(PROCESS_ON_PC ? { processor: 'local' as const } : {}),
    ...(generate && generateInput ? { generateInput } : {}),
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

/**
 * Cria um playback a partir de faixas prontas (ex.: exportadas do Moises): envia cada faixa para
 * `playbacks/{uid}/import/{id}/` e pede o processamento (Function `import_stems`). O worker junta as
 * faixas no áudio completo, reconhece a letra na voz e sincroniza; não separa nada. `onProgress`: 0..1.
 */
export async function uploadStems(opts: {
  lyricId: string;
  uid: string;
  stems: StemFile[];
  label: string;
  onProgress?: (fraction: number) => void;
}): Promise<UploadHandle> {
  const { lyricId, uid, stems, label, onProgress } = opts;
  if (!stems.length) throw new Error('Escolha as faixas.');
  const ref = doc(collection(database, COL));
  const importStems: ImportStem[] = stems.map((s, i) => {
    const ext = extOf(s.file.name).replace(/[^a-z0-9]/g, '') || 'mp3';
    return { name: s.name, label: s.label, path: `playbacks/${uid}/import/${ref.id}/${String(i).padStart(2, '0')}-${s.name}.${ext}` };
  });
  // "Musica - Vocals.flac" -> "Musica"; sem título no nome do arquivo, um nome genérico
  const first = stems[0].file.name.split('/').pop()!.replace(/\.[^.]+$/, '');
  const title = first.replace(/\s*[-_(]\s*[^-_(]*$/, '').trim();
  const data: PlaybackType = {
    lyricId,
    userId: uid,
    label: label.trim() || (title && title !== first ? title : 'Faixas importadas'),
    fileName: stems.map((s) => s.file.name).join(', ').slice(0, 300),
    // áudio completo, montado pelo worker com a soma das faixas
    storagePath: `playbacks/${uid}/${ref.id}.mix.mp3`,
    status: 'uploading',
    source: 'stems',
    importStems,
    ...(PROCESS_ON_PC ? { processor: 'local' as const } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  const { ref: sref, uploadBytesResumable, deleteObject } = await import('firebase/storage');
  const storage = await getAppStorage();
  const total = stems.reduce((n, s) => n + s.file.size, 0) || 1;
  const sent = stems.map(() => 0);
  const tasks: ReturnType<typeof uploadBytesResumable>[] = [];
  let canceled = false;

  const one = (i: number) => new Promise<void>((resolve, reject) => {
    if (canceled) { reject(new Error('Envio cancelado.')); return; }
    const s = stems[i];
    const task = uploadBytesResumable(sref(storage, importStems[i].path), s.file, {
      contentType: audioContentType(s.file.name, s.file.type),
    });
    tasks.push(task);
    task.on(
      'state_changed',
      (snap) => {
        sent[i] = snap.bytesTransferred;
        onProgress?.(sent.reduce((a, b) => a + b, 0) / total);
      },
      (err) => reject(err.code === 'storage/canceled' ? new Error('Envio cancelado.') : err),
      () => resolve(),
    );
  });

  const done = (async () => {
    try {
      // 3 de cada vez: rápido sem engasgar a conexão
      let next = 0;
      const lane = async () => { while (next < stems.length) await one(next++); };
      await Promise.all([lane(), lane(), lane()]);
      const { httpsCallable } = await import('firebase/functions');
      const call = httpsCallable<{ playbackId: string }, { ok: boolean }>(
        await getAppFunctions(FUNCTIONS_REGION),
        'import_stems',
      );
      await call({ playbackId: ref.id });
    } catch (e) {
      canceled = true;
      tasks.forEach((t) => { try { t.cancel(); } catch { /* já terminou */ } });
      await Promise.all(importStems.map((s) => deleteObject(sref(storage, s.path)).catch(() => undefined)));
      await deleteDoc(ref).catch(() => undefined);
      throw e;
    }
  })();
  return {
    id: ref.id,
    done,
    cancel: () => { canceled = true; tasks.forEach((t) => { try { t.cancel(); } catch { /* já terminou */ } }); },
  };
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

/** Liga à música (recém-salva) um playback enviado na tela de adicionar música. */
export async function attachPlayback(id: string, lyricId: string) {
  await updateDoc(doc(database, COL, id), { lyricId, updatedAt: serverTimestamp() });
}

/**
 * Gera a cifra pelo áudio (acordes + letra reconhecida) e grava em `generated`. Com o playback já
 * processado leva segundos; senão o processamento roda de novo e gera no fim (acompanhe pelo watch).
 */
export async function generateCifra(id: string, input?: GenerateInput | null) {
  const { httpsCallable } = await import('firebase/functions');
  type Req = { playbackId: string; lyrics?: string; synced?: GenerateInput['synced']; lyricsSource?: string | null };
  const call = httpsCallable<Req, { ok: boolean; status: 'ready' | 'processing' }>(
    await getAppFunctions(FUNCTIONS_REGION),
    'generate_cifra',
  );
  return (await call({
    playbackId: id,
    ...(input?.lyrics ? { lyrics: input.lyrics, synced: input.synced, lyricsSource: input.source } : {}),
  })).data;
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

/**
 * Processa o playback de novo (faixas, voz e sincronia): para playbacks antigos, com erro ou parados.
 * Roda em segundo plano; o andamento chega pelo `watchPlaybacks`.
 */
export async function reprocessPlayback(id: string) {
  const { httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<{ playbackId: string }, { ok: boolean; status: string }>(
    await getAppFunctions(FUNCTIONS_REGION),
    'reprocess_playback',
  );
  return (await call({ playbackId: id })).data;
}

/** Processamento parado há muito tempo (o job morreu): o app deixa pedir de novo. Igual ao STALE_SEC da Function. */
export const PROCESSING_STALE_MS = 35 * 60 * 1000;
/** Reconhecendo os acordes de novo e parado há muito tempo: o job morreu. */
export function generatedStale(p: PlaybackType): boolean {
  if (p.generated?.status !== 'processing') return false;
  const ms = (p.generated.requestedAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  return ms != null && Date.now() - ms > PROCESSING_STALE_MS;
}

/** Os acordes estão sendo reconhecidos de novo (o playback continua pronto). */
export function regeneratingChords(p: PlaybackType | null | undefined): boolean {
  return !!p && p.generated?.status === 'processing' && !generatedStale(p);
}

export function processingStale(p: PlaybackType): boolean {
  if (p.status !== 'processing') return false;
  const ms = (p.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  return ms != null && Date.now() - ms > PROCESSING_STALE_MS;
}

/** Feito antes do processamento com faixas e voz (só sincronia pelos acordes): vale processar de novo. */
export function needsReprocess(p: PlaybackType): boolean {
  return p.status === 'ready' && !p.stems;
}

/** Faixas ligadas/desligadas/solo e volume (0..1, padrão 1) de cada playback (no aparelho). */
export type StemMix = Record<string, { on: boolean; solo: boolean; vol?: number }>;
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
