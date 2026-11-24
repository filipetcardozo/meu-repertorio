/**
 * Ultimate Guitar
 * - Busca: /search.php?search_type=title&value=... (HTML).
 * - Música: tabs.ultimate-guitar.com/tab/...
 * Nas duas, os dados vêm num JSON dentro de `<div class="js-store" data-content="...">` no HTML
 * bruto (a página remove esse elemento depois de carregar). Na cifra, os acordes vêm como
 * [ch]Am[/ch], os pares acorde/letra entre [tab]...[/tab] e as seções como [Verse 1].
 */
import type { CifraImport, CifraSearchResult, CifraVersion } from '../cifraClub';
import { decodeEntities, isTone, linesToCifraHtml, markChord, sectionName } from './format';

export const ugSearchUrl = (q: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`;

function readStore(html: string): any {
  const m = html.match(/class="js-store"\s+data-content="([^"]*)"/);
  if (!m) throw new Error('Não foi possível ler a página do Ultimate Guitar.');
  return JSON.parse(decodeEntities(m[1]))?.store?.page?.data ?? {};
}

const stars = (rating?: number, votes?: number) =>
  votes ? `★ ${Number(rating ?? 0).toFixed(1)} · ${votes} voto${votes === 1 ? '' : 's'}` : undefined;

export function parseUgSearch(html: string, limit = 8): CifraSearchResult[] {
  const results: any[] = readStore(html).results ?? [];
  return results
    .filter((r) => r?.type === 'Chords' && typeof r.tab_url === 'string')
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, limit)
    .map((r) => ({
      source: 'ultimateguitar' as const,
      artist: String(r.artist_name ?? ''),
      song: String(r.song_name ?? ''),
      url: r.tab_url,
      detail: [r.version > 1 ? `versão ${r.version}` : '', stars(r.rating, r.votes)].filter(Boolean).join(' · ') || undefined,
    }));
}

export function normalizeUgUrl(raw: string): string {
  const u = new URL(raw.trim());
  if (u.hostname !== 'tabs.ultimate-guitar.com' || !/^\/tab\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/i.test(u.pathname)) {
    throw new Error('O link precisa ser de uma cifra do Ultimate Guitar (tabs.ultimate-guitar.com/tab/...).');
  }
  return `https://tabs.ultimate-guitar.com${u.pathname.replace(/\/$/, '')}`;
}

const CH = /\[ch\]([\s\S]*?)\[\/ch\]/g;

export function parseUgPage(html: string, url: string): CifraImport {
  const data = readStore(html);
  const tab = data.tab ?? {};
  const view = data.tab_view ?? {};
  const content: string = view.wiki_tab?.content ?? '';
  if (!content.trim()) throw new Error('Essa página do Ultimate Guitar não tem cifra.');

  const lines = content
    .replace(/\r\n?/g, '\n')
    .replace(/\[\/?tab\]/g, '')
    .split('\n')
    .map((line) => {
      const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
      if (section && !/^\/?ch$/i.test(section[1])) return `[${sectionName(section[1])}]`;
      return line.replace(CH, (_, c) => markChord(c));
    });

  const meta = view.meta ?? {};
  const capo = Number(meta.capo);
  const tuning = meta.tuning?.name && meta.tuning.name !== 'Standard' ? String(meta.tuning.value ?? meta.tuning.name) : undefined;
  const tone = isTone(meta.tonality) ? meta.tonality : isTone(tab.tonality_name) ? tab.tonality_name : '';
  const versions: CifraVersion[] = (view.versions ?? [])
    .filter((v: any) => v?.type === 'Chords' && typeof v.tab_url === 'string')
    .map((v: any) => ({ label: `Versão ${v.version ?? ''}`.trim(), url: v.tab_url }));
  if (versions.length && !versions.some((v) => v.url === url)) {
    versions.unshift({ label: `Versão ${tab.version ?? 1}`, url });
  }

  return {
    url,
    song: String(tab.song_name ?? ''),
    artist: String(tab.artist_name ?? ''),
    tone,
    lyric: linesToCifraHtml(lines),
    capo: Number.isFinite(capo) && capo > 0 ? capo : undefined,
    tuning,
    versionLabel: tab.version ? `Versão ${tab.version}` : undefined,
    versions: versions.length > 1 ? versions : undefined,
  };
}
