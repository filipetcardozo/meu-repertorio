/**
 * Cifras.com.br
 * - Busca: /api/search?q=...&only[]=songs (JSON).
 * - Música: /cifra/{artista}/{musica}. A cifra vem num <pre> com acordes em
 *   <span data-chord="X">X</span> e títulos em <strong>[Refrão]</strong>; tom, gênero e
 *   compositores vêm no JSON-LD (MusicComposition).
 */
import type { CifraImport, CifraSearchResult } from '../cifraClub';
import { decodeEntities, isTone, linesToCifraHtml, markChord, readJsonLd } from './format';

const ORIGIN = 'https://www.cifras.com.br';

export const cifrasSearchUrl = (q: string, limit = 8) =>
  `${ORIGIN}/api/search?q=${encodeURIComponent(q)}&only[]=songs&songs_take=${limit}`;

export function parseCifrasSearch(json: string): CifraSearchResult[] {
  const data = JSON.parse(json);
  const hits: any[] = data?.songs?.hits ?? [];
  return hits
    .filter((h) => h?.COD_ARTISTA && h?.COD_TITULO && (h.INSTRUMENTOS ?? []).some((i: any) => i?.SLUG === 'cifra'))
    .map((h) => ({
      source: 'cifras' as const,
      artist: String(h.ARTISTA ?? ''),
      song: String(h.TITULO ?? ''),
      url: `${ORIGIN}/cifra/${h.COD_ARTISTA}/${h.COD_TITULO}`,
      image: typeof h.AVATAR === 'string' && !h.AVATAR.includes('no-photo') ? h.AVATAR : undefined,
    }));
}

/** Aceita só páginas de música do Cifras (evita pedir qualquer endereço à extensão). */
export function normalizeCifrasUrl(raw: string): string {
  const u = new URL(raw.trim());
  const m = u.pathname.match(/^\/cifra\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/i);
  if (!/^(www\.)?cifras\.com\.br$/.test(u.hostname) || !m) {
    throw new Error('O link precisa ser de uma cifra do Cifras.com.br (cifras.com.br/cifra/artista/musica).');
  }
  return `${ORIGIN}/cifra/${m[1]}/${m[2]}`;
}

export function parseCifrasPage(html: string, url: string): CifraImport {
  const start = html.search(/<pre\b/i);
  const end = html.indexOf('</pre>', start);
  if (start < 0 || end < 0) throw new Error('Essa página do Cifras não tem cifra.');
  const inner = html.slice(html.indexOf('>', start) + 1, end);

  const text = decodeEntities(
    inner
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Acorde: o texto visível ocupa as colunas certas
      .replace(/<span\b[^>]*data-chord="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (_, c) => markChord(c.replace(/<[^>]+>/g, '')))
      // "[Intro:  ]" → "[Intro]"
      .replace(/<strong\b[^>]*>\s*\[([^\]]*)\]\s*<\/strong>/gi, (_, n) => `[${n.replace(/[:\s]+$/, '').trim()}] `)
      .replace(/<[^>]+>/g, ''),
  );
  // O título de seção ganha linha própria quando vem colado no texto de baixo
  const lines = text.split('\n').map((l) => l.replace(/^(\[[^\]]+\]) $/, '$1'));

  const ld = readJsonLd(html, 'MusicComposition');
  const og = decodeEntities(html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? '');
  const [ogSong, ogArtist] = og.replace(/\s*\|\s*CIFRAS\s*$/i, '').split(' - ');
  const composers = String(ld?.composer?.name ?? '')
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tone = isTone(ld?.musicalKey) ? ld.musicalKey.trim() : html.match(/Tom:\s*([A-G][#b]?m?)\b/)?.[1] ?? '';

  return {
    url,
    song: String(ld?.name ?? ogSong ?? '').trim(),
    artist: String(ld?.recordedAs?.byArtist?.name ?? ogArtist ?? '').trim(),
    tone,
    lyric: linesToCifraHtml(lines),
    genre: typeof ld?.genre === 'string' ? ld.genre : undefined,
    songwriters: composers.length ? composers : undefined,
  };
}
