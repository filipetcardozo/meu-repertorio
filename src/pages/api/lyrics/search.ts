import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpError } from '../../../lib/httpError';
import { searchLyrics } from '../../../lib/lyricsSearch';

/** GET /api/lyrics/search?song=&artist=&duration= → { results: LyricsResult[] } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const song = String(req.query.song ?? '').slice(0, 120).trim();
  const artist = String(req.query.artist ?? '').slice(0, 120).trim();
  const duration = Number(req.query.duration) || undefined;
  if (song.length < 2) return res.status(400).json({ error: 'Informe o nome da música.' });

  try {
    const results = await searchLyrics(song, artist, duration);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ results });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return res.status(status).json({ error: e instanceof Error ? e.message : 'Erro ao buscar a letra.' });
  }
}
