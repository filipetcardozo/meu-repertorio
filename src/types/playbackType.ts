/**
 * Playback (mp3) de uma música, sincronizado com a cifra pela Cloud Function `analyze_playback`.
 *
 * Firestore: playbacks/{id} (privado do dono). Áudio: Storage playbacks/{userId}/{id}.mp3.
 * Fluxo: o app cria o doc (status 'uploading'), envia o arquivo; a Function marca 'processing',
 * analisa e grava 'ready' com a linha do tempo (ou 'error').
 */
export type PlaybackStatus = 'uploading' | 'processing' | 'ready' | 'error';

/** Um ponto da linha do tempo, na ordem tocada. `text` null = trecho fora da cifra (intro/solo não escritos). */
export type PlaybackSyncItem = {
  /** Início, em segundos. */
  t: number;
  /** Índice da linha de letra (mesma ordem do domLines.ts); null em linha só de acordes. */
  lyricIdx: number | null;
  text: string | null;
  chords: string[] | null;
  section: string | null;
  /** Confiança 0..1 (abaixo de 0,6 = conferir). */
  conf: number | null;
};

export type PlaybackType = {
  id?: string;
  lyricId: string;
  userId: string;
  label: string;
  fileName: string;
  storagePath: string;
  status: PlaybackStatus;
  error?: string | null;
  durationSec?: number;
  bpm?: number;
  /** Semitons do playback em relação ao tom original da cifra. */
  transpose?: number;
  timeline?: PlaybackSyncItem[];
  /** Hash da cifra usada na sincronia (se a cifra mudar, dá para re-sincronizar). */
  cifraHash?: string;
  /** Análise do áudio guardada no Storage (re-sincronizar sem reprocessar o áudio). */
  analysisPath?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
