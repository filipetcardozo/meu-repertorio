import type { NextApiRequest, NextApiResponse } from 'next';
import { AiError, activeProvider } from '../../../lib/ai/provider';
import { mergeCifra } from '../../../lib/ai/mergeCifra';
import { MAX_CIFRA_CHARS } from '../../../lib/ai/improveCifra';
import { HttpError } from '../../../lib/httpError';

// Mesmo limite do "Melhorar cifra" (plano Hobby da Vercel: até 60 s).
export const config = { maxDuration: 60 };

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 20;
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/**
 * POST { reference, audio, lyrics?, referenceTone?, audioTone?, lyricName?, composerName? }
 * → { lyric, tone, notes, audioShift, remaining }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.status(200).json({ enabled: !!activeProvider() });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  try {
    if (!activeProvider()) throw new AiError('A IA ainda não foi configurada no servidor.', 503);
    const { consumeDailyQuota, requireUser } = await import('../../../lib/firebaseAdmin');
    const { uid } = await requireUser(req);

    const reference = req.body?.reference;
    const audio = req.body?.audio;
    if (typeof reference !== 'string' || !reference.trim()) throw new HttpError('Envie a cifra de referência.', 400);
    if (typeof audio !== 'string' || !audio.trim()) throw new HttpError('Envie a cifra gerada pelo áudio.', 400);
    if (reference.length > MAX_CIFRA_CHARS * 3 || audio.length > MAX_CIFRA_CHARS * 2) {
      throw new HttpError('A cifra é longa demais para a IA.', 413);
    }

    const { remaining } = await consumeDailyQuota(uid, 'mergeCifra', DAILY_LIMIT);
    const result = await mergeCifra({
      reference,
      audio,
      lyrics: str(req.body?.lyrics, 20000),
      referenceTone: str(req.body?.referenceTone, 10),
      audioTone: str(req.body?.audioTone, 10),
      lyricName: str(req.body?.lyricName),
      composerName: str(req.body?.composerName),
    });
    return res.status(200).json({ ...result, remaining });
  } catch (e) {
    const status = e instanceof HttpError || e instanceof AiError ? e.status : 500;
    if (status === 500) console.error('merge-cifra:', e);
    return res.status(status).json({ error: status === 500 ? 'Erro inesperado. Tente de novo.' : (e as Error).message });
  }
}
