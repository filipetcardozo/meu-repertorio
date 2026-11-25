/**
 * Cloud Functions (Node) da cifra gerada pelo áudio. As de áudio (separar, reconhecer a voz, sincronizar,
 * gerar a cifra) são Python, na pasta functions/; estas usam o código TypeScript do app (src/), copiado
 * no build (copy-shared.mjs).
 *
 * searchLyrics (chamável): letra da música na internet (LRCLIB), muitas com o tempo de cada linha.
 * mergeCifra (chamável): junta a cifra de referência (acordes), a letra completa e a cifra gerada pelo
 *   áudio (estrutura e tempo) com IA. Até 5 min (a IA leva ~30-40 s por tentativa e pode tentar de novo).
 *
 * Chave da IA: segredo OPENAI_API_KEY (Secret Manager). Para usar a Anthropic, crie o segredo
 * ANTHROPIC_API_KEY e acrescente em `secrets` abaixo (o provedor escolhe pelo que tiver chave).
 */
import { HttpsError, onCall, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { searchLyrics as findLyrics } from './shared/lib/lyricsSearch';
import { mergeCifra as merge } from './shared/lib/ai/mergeCifra';
import { MAX_CIFRA_CHARS } from './shared/lib/ai/improveCifra';
import { AiError } from './shared/lib/ai/provider';
import { HttpError } from './shared/lib/httpError';

const REGION = 'us-central1';
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Aqui não há o limite de 60 s da Vercel: a segunda tentativa da IA sempre cabe.
process.env.AI_MERGE_RETRY_BUDGET_MS ??= '200000';

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined);

function codeOf(status: number): FunctionsErrorCode {
  if (status === 400 || status === 413) return 'invalid-argument';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'permission-denied';
  if (status === 404) return 'not-found';
  if (status === 422) return 'failed-precondition';
  if (status === 429) return 'resource-exhausted';
  if (status >= 500) return 'unavailable';
  return 'internal';
}

/** Erros com mensagem para o usuário (HttpError/AiError) viram HttpsError; o resto, erro genérico. */
function toHttpsError(e: unknown, where: string): HttpsError {
  if (e instanceof HttpsError) return e;
  if (e instanceof HttpError || e instanceof AiError) return new HttpsError(codeOf(e.status), e.message);
  console.error(`${where}:`, e);
  return new HttpsError('internal', 'Erro inesperado. Tente de novo.');
}

function requireAuth(auth: unknown) {
  if (!auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
}

export const searchLyrics = onCall({ region: REGION, memory: '256MiB', timeoutSeconds: 30 }, async (req) => {
  requireAuth(req.auth);
  const song = (str(req.data?.song, 120) ?? '').trim();
  const artist = (str(req.data?.artist, 120) ?? '').trim();
  const duration = Number(req.data?.duration) || undefined;
  if (song.length < 2) throw new HttpsError('invalid-argument', 'Informe o nome da música.');
  try {
    return { results: await findLyrics(song, artist, duration) };
  } catch (e) {
    throw toHttpsError(e, 'searchLyrics');
  }
});

export const mergeCifra = onCall(
  { region: REGION, memory: '512MiB', timeoutSeconds: 300, secrets: [OPENAI_API_KEY] },
  async (req) => {
    requireAuth(req.auth);
    const reference = req.data?.reference;
    const audio = req.data?.audio;
    if (typeof reference !== 'string' || !reference.trim()) throw new HttpsError('invalid-argument', 'Envie a cifra de referência.');
    if (typeof audio !== 'string' || !audio.trim()) throw new HttpsError('invalid-argument', 'Envie a cifra gerada pelo áudio.');
    if (reference.length > MAX_CIFRA_CHARS * 3 || audio.length > MAX_CIFRA_CHARS * 2) {
      throw new HttpsError('invalid-argument', 'A cifra é longa demais para a IA.');
    }
    try {
      return await merge({
        reference,
        audio,
        lyrics: str(req.data?.lyrics, 20000),
        referenceTone: str(req.data?.referenceTone, 10),
        audioTone: str(req.data?.audioTone, 10),
        lyricName: str(req.data?.lyricName),
        composerName: str(req.data?.composerName),
      });
    } catch (e) {
      throw toHttpsError(e, 'mergeCifra');
    }
  },
);
