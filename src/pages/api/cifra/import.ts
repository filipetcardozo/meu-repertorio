import type { NextApiRequest, NextApiResponse } from 'next';
import { CifraError, importFromCifraClub } from '../../../lib/cifraClub';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const url = String(req.query.url ?? '');
  if (!url) return res.status(400).json({ error: 'Informe o link da música.' });

  try {
    const data = await importFromCifraClub(url);
    return res.status(200).json(data);
  } catch (e) {
    const status = e instanceof CifraError ? e.status : 500;
    return res.status(status).json({
      error: e instanceof Error ? e.message : 'Erro ao importar.',
      code: e instanceof CifraError ? e.code : undefined,
    });
  }
}
