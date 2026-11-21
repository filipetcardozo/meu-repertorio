import type { NextApiRequest, NextApiResponse } from 'next';
import { CifraError, searchCifraClub } from '../../../lib/cifraClub';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const q = String(req.query.q ?? '').slice(0, 120);
  if (q.trim().length < 2) return res.status(200).json({ results: [] });

  try {
    const results = await searchCifraClub(q);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ results });
  } catch (e) {
    const status = e instanceof CifraError ? e.status : 500;
    return res.status(status).json({ error: e instanceof Error ? e.message : 'Erro ao buscar.' });
  }
}
