import type { NextApiRequest, NextApiResponse } from 'next';
import { AiError, activeProvider } from '../../../lib/ai/provider';
import { improveCifra, MAX_CIFRA_CHARS } from '../../../lib/ai/improveCifra';
import { consumeDailyQuota, HttpError, requireUser } from '../../../lib/firebaseAdmin';

// A IA pode levar mais de um minuto numa cifra longa (e há uma segunda tentativa se a conferência falhar),
// mas o plano Hobby da Vercel recusa o deploy com mais de 60s. Para subir este limite, troque de plano ou ative o Fluid Compute.
export const config = { maxDuration: 60 };

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 20;
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // A tela pergunta se a IA está ligada para mostrar (ou não) o botão.
    return res.status(200).json({ enabled: !!activeProvider() });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    if (!activeProvider()) throw new AiError('A IA ainda não foi configurada no servidor.', 503);
    const { uid } = await requireUser(req);

    const lyric = req.body?.lyric;
    if (typeof lyric !== 'string' || !lyric.trim()) throw new HttpError('Envie a cifra.', 400);
    if (lyric.length > MAX_CIFRA_CHARS * 3) throw new HttpError('A cifra é longa demais para a IA.', 413);

    const { remaining } = await consumeDailyQuota(uid, 'improveCifra', DAILY_LIMIT);
    const result = await improveCifra({
      lyric,
      lyricName: str(req.body?.lyricName),
      composerName: str(req.body?.composerName),
      originalTone: str(req.body?.originalTone, 10),
    });
    return res.status(200).json({ ...result, remaining });
  } catch (e) {
    const status = e instanceof HttpError || e instanceof AiError ? e.status : 500;
    if (status === 500) console.error('improve-cifra:', e);
    return res.status(status).json({ error: status === 500 ? 'Erro inesperado. Tente de novo.' : (e as Error).message });
  }
}
