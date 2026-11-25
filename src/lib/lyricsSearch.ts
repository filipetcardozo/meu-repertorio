/**
 * Busca a letra de uma música na internet (LRCLIB, base aberta de letras, muitas com o tempo de cada
 * linha). A letra serve para gerar a cifra pelo áudio: a voz reconhecida só diz quando cada palavra
 * é cantada, e o texto vem daqui.
 */
import { HttpError } from './httpError';

export type SyncedLine = { t: number; text: string };

export type LyricsResult = {
  source: 'lrclib';
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  /** Estrofes separadas por linha em branco. */
  lyrics: string;
  /** Linhas com o tempo (s), quando a fonte tem. */
  synced: SyncedLine[] | null;
};

type LrclibItem = {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

const API = 'https://lrclib.net/api/search';

const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\((ao vivo|live|ac[uú]stico|remix|feat[^)]*|part[^)]*)\)/g, ' ')
    .replace(/\b(ao vivo|live|acustico)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();

function similarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter(Boolean));
  const tb = new Set(norm(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter += 1; });
  return inter / Math.max(ta.size, tb.size);
}

export function parseLrc(lrc: string): SyncedLine[] {
  const out: SyncedLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const m = raw.match(/^((?:\[\d+:\d+(?:\.\d+)?\])+)(.*)$/);
    if (!m) continue;
    const text = m[2].trim();
    for (const tag of m[1].matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)) {
      out.push({ t: Number(tag[1]) * 60 + Number(tag[2]), text });
    }
  }
  return out.sort((x, y) => x.t - y.t);
}

async function query(params: Record<string, string>): Promise<LrclibItem[]> {
  const url = `${API}?${new URLSearchParams(params).toString()}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'TocaMaisUma/1.0 (cifras e repertorio)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new HttpError('A busca de letras não respondeu. Tente de novo.', 502);
  return (await r.json()) as LrclibItem[];
}

/**
 * Melhores letras para a música (até 5), da mais provável para a menos: nome e artista parecidos e,
 * se `duration` vier (duração do áudio), duração perto.
 */
export async function searchLyrics(song: string, artist: string, duration?: number): Promise<LyricsResult[]> {
  let items = artist ? await query({ track_name: song, artist_name: artist }) : [];
  if (!items.length) items = await query({ q: `${song} ${artist}`.trim() });
  if (!items.length) items = await query({ track_name: song });

  const scored = items
    .filter((x) => !x.instrumental && (x.plainLyrics || x.syncedLyrics))
    .map((x) => {
      let s = 2 * similarity(song, x.trackName) + (artist ? similarity(artist, x.artistName) : 0);
      if (artist && norm(x.artistName).includes(norm(artist))) s += 0.5;
      if (duration && x.duration) s -= Math.min(1, Math.abs(duration - x.duration) / 30);
      if (x.syncedLyrics) s += 0.15;
      return { x, s };
    })
    .filter(({ x }) => similarity(song, x.trackName) >= 0.5)
    .sort((a, b) => b.s - a.s)
    // a mesma letra aparece várias vezes (álbum, single, coletânea): fica a primeira
    .filter(({ x }, i, arr) => arr.findIndex((o) => norm(o.x.plainLyrics ?? '') === norm(x.plainLyrics ?? '')) === i)
    .slice(0, 5);

  return scored.map(({ x }) => {
    const synced = x.syncedLyrics ? parseLrc(x.syncedLyrics) : null;
    const lyrics = (x.plainLyrics || (synced ?? []).map((l) => l.text).join('\n')).trim();
    return {
      source: 'lrclib' as const,
      trackName: x.trackName,
      artistName: x.artistName,
      albumName: x.albumName,
      duration: x.duration,
      lyrics,
      synced: synced?.length ? synced : null,
    };
  });
}
