/**
 * Playback (mp3) de uma música, sincronizado com a cifra.
 *
 * Firestore: playbacks/{id} (privado do dono). Áudio: Storage playbacks/{userId}/{id}.mp3.
 * Fluxo: o app cria o doc (status 'uploading') e envia o arquivo; a Function `analyze_playback`
 * marca 'processing' e dispara o job do Cloud Run (worker/), que separa as faixas, reconhece a letra
 * na voz, alinha com a cifra e grava 'ready' com a linha do tempo (ou 'error'). Nada provisório:
 * a música só fica pronta no fim.
 */
export type PlaybackStatus = 'uploading' | 'processing' | 'ready' | 'error';

/** Etapa do processamento (com `progress` 0..1 no documento). */
export type PlaybackStage = 'queued' | 'separating' | 'transcribing' | 'syncing';

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

/** Faixas que o modelo htdemucs_6s devolve. */
export type StemName = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'other';

/**
 * Faixas separadas (Demucs, parte do processamento do worker): `playbacks/{id}.stems`, gravado só pelo
 * servidor. As faixas ficam em Storage `playbacks/{userId}/stems/{id}/{faixa}.mp3`. Se a separação
 * falhar, o playback fica pronto mesmo assim (só com o áudio original) e `status` = 'error'.
 */
export type PlaybackStems = {
  status: 'ready' | 'error';
  model?: string;
  error?: string | null;
  tracks?: { name: StemName | string; path: string }[];
  /** Ganho para a soma das faixas voltar ao volume do original (as faixas são gravadas com folga). */
  gain?: number;
  durationSec?: number;
};

/**
 * Cifra gerada pela plataforma a partir do áudio (acordes reconhecidos + letra da voz), gravada pelo
 * servidor em `playbacks/{id}.generated`. É um rascunho: a pessoa revisa e salva na música.
 */
export type PlaybackGenerated = {
  /** 'processing' = reconhecendo os acordes de novo (playback processado antes do consonance-ACE). */
  status: 'ready' | 'error' | 'processing';
  error?: string | null;
  /** Modelo que reconheceu os acordes (ex.: "consonance-ACE conformer_decomposed_smooth@d17633a"). */
  chordModel?: string | null;
  requestedAt?: unknown;
  /** HTML no formato da cifra salva (`<pre>` com acordes em `<b>`). */
  lyric?: string;
  tone?: string;
  bpm?: number;
  /** Linhas de letra e palavras reconhecidas (0 = só acordes, playback sem voz). */
  lines?: number;
  words?: number;
  /** 'lyrics' = letra informada (internet/digitada) sincronizada pela voz; 'voice' = letra reconhecida na voz. */
  lyricsSource?: 'lyrics' | 'voice';
  /** De onde veio a letra informada ('lrclib', 'manual'). */
  lyricsFrom?: string | null;
  model?: string | null;
  createdAt?: unknown;
};

/** Letra informada para gerar a cifra (o servidor usa no fim do processamento). */
export type GenerateInput = {
  lyrics: string;
  synced: { t: number; text: string }[] | null;
  source: string | null;
};

export type PlaybackType = {
  id?: string;
  /** '' = enviado na tela de adicionar música, antes de a música existir (ligado ao salvar). */
  lyricId: string;
  userId: string;
  label: string;
  fileName: string;
  storagePath: string;
  status: PlaybackStatus;
  /** Durante 'processing': etapa atual e andamento 0..1. */
  stage?: PlaybackStage | null;
  progress?: number;
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
  /** Palavras reconhecidas na voz (re-sincronizar também usa a letra). */
  wordsPath?: string | null;
  /** Quantas palavras da voz entraram no alinhamento (0 = só pelos acordes). */
  voiceWords?: number;
  stems?: PlaybackStems | null;
  /** Pediu a cifra gerada pela plataforma (o processamento grava `generated` no fim). */
  generate?: boolean;
  generateInput?: GenerateInput | null;
  generated?: PlaybackGenerated | null;
  /** Acordes reconhecidos pelo worker (consonance-ACE), para regenerar a cifra sem rodar o modelo de novo. */
  chordsPath?: string | null;
  /** 'local' = processar no PC de quem desenvolve (só admin; ver PROCESS_ON_PC em providers/playbacks). */
  processor?: 'local';
  /** Processamento no PC: 'waiting' = na fila do worker/local_listener.py; 'running' = rodando. */
  localWorker?: 'waiting' | 'running' | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};
