import { getAppFunctions } from '../../../firebaseConfig';
import type { LyricsResult } from '../../lib/lyricsSearch';

/** Cloud Functions em Node (pasta functions-ai/). */
const FUNCTIONS_REGION = 'us-central1';

export type MergeResult = { lyric: string; tone: string; notes: string[]; audioShift: number };

/** A junção mostra o botão sempre; se a IA não estiver configurada, o erro aparece ao usar. */
export const mergeAiEnabled = () => Promise.resolve(true);

async function callable<Req, Res>(name: string, timeout = 70000) {
  const { httpsCallable } = await import('firebase/functions');
  return httpsCallable<Req, Res>(await getAppFunctions(FUNCTIONS_REGION), name, { timeout });
}

/** Mensagem do servidor (HttpsError) ou uma genérica. */
function messageOf(e: unknown, fallback: string) {
  const msg = (e as { message?: string })?.message;
  return msg && !/^internal$/i.test(msg) ? msg : fallback;
}

/** Junta a cifra de referência, a letra e a cifra gerada pelo áudio (functions-ai: mergeCifra). */
export async function mergeCifraWithAi(body: {
  reference: string;
  referenceTone?: string;
  audio: string;
  audioTone?: string;
  lyrics?: string;
  lyricName?: string;
  composerName?: string;
}): Promise<MergeResult> {
  try {
    // a IA pode tentar duas vezes (~30-40 s cada); a Function aguenta até 5 min
    const call = await callable<typeof body, MergeResult>('mergeCifra', 310000);
    return (await call(body)).data;
  } catch (e) {
    throw new Error(messageOf(e, 'Não foi possível juntar as cifras.'));
  }
}

/** Letra da música na internet (functions-ai: searchLyrics). */
export async function searchLyricsOnline(song: string, artist: string, duration?: number): Promise<LyricsResult[]> {
  try {
    const call = await callable<{ song: string; artist: string; duration?: number }, { results: LyricsResult[] }>('searchLyrics', 40000);
    return (await call({ song, artist, ...(duration ? { duration: Math.round(duration) } : {}) })).data.results ?? [];
  } catch (e) {
    throw new Error(messageOf(e, 'Não foi possível buscar a letra.'));
  }
}
