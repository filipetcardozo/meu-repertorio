/**
 * Fontes de cifras: Cifra Club (busca pelo servidor) + Cifras.com.br e Ultimate Guitar
 * (busca e importação pela extensão, no navegador do usuário).
 */
import { findArtistImage, type CifraImport, type CifraSearchResult } from '../cifraClub';
import { fetchWithExtension, findSourceFetcher } from '../cifraClubExtension';
import { cifrasSearchUrl, normalizeCifrasUrl, parseCifrasPage, parseCifrasSearch } from './cifras';
import { normalizeUgUrl, parseUgPage, parseUgSearch, ugSearchUrl } from './ultimateGuitar';

export type SourceId = 'cifraclub' | 'cifras' | 'ultimateguitar';

export const SOURCE_LABEL: Record<SourceId, string> = {
  cifraclub: 'Cifra Club',
  cifras: 'Cifras.com.br',
  ultimateguitar: 'Ultimate Guitar',
};

/** Fontes que precisam da extensão. */
export const EXTENSION_SOURCES: SourceId[] = ['cifras', 'ultimateguitar'];

export function sourceOfUrl(raw: string): SourceId | null {
  try {
    const host = new URL(raw.trim()).hostname;
    if (/^((www|m)\.)?cifraclub\.com\.br$/.test(host)) return 'cifraclub';
    if (/^(www\.)?cifras\.com\.br$/.test(host)) return 'cifras';
    if (/(^|\.)ultimate-guitar\.com$/.test(host)) return 'ultimateguitar';
  } catch {
    /* não é URL */
  }
  return null;
}

export const isSourceUrl = (s: string) => /^https?:\/\//i.test(s.trim()) && !!sourceOfUrl(s);

/** A extensão instalada busca nas outras fontes? */
export const canUseExtensionSources = async () => !!(await findSourceFetcher());

/** Busca numa fonte da extensão. Lança erro se a extensão não estiver disponível. */
export async function searchExtensionSource(source: SourceId, q: string): Promise<CifraSearchResult[]> {
  const url = source === 'cifras' ? cifrasSearchUrl(q) : ugSearchUrl(q);
  const page = await fetchWithExtension(url);
  if (!page) throw new ExtensionMissingError(source);
  return source === 'cifras' ? parseCifrasSearch(page.html) : parseUgSearch(page.html);
}

export class ExtensionMissingError extends Error {
  constructor(public source: SourceId) {
    super(`Para importar do ${SOURCE_LABEL[source]}, instale (ou atualize) a extensão Toca Mais Uma no Chrome para computador.`);
  }
}

/** Importa de Cifras.com.br ou Ultimate Guitar (o Cifra Club tem o próprio caminho, com servidor). */
export async function importFromExtensionSource(rawUrl: string): Promise<CifraImport> {
  const source = sourceOfUrl(rawUrl);
  if (source !== 'cifras' && source !== 'ultimateguitar') throw new Error('Link de cifra não suportado.');
  const url = source === 'cifras' ? normalizeCifrasUrl(rawUrl) : normalizeUgUrl(rawUrl);
  const page = await fetchWithExtension(url);
  if (!page) throw new ExtensionMissingError(source);
  const data = source === 'cifras' ? parseCifrasPage(page.html, url) : parseUgPage(page.html, url);
  // Foto do artista: vem da busca do Cifra Club (a mesma usada nas outras importações)
  return { ...data, artistImage: await findArtistImage(data.artist, undefined, {}) };
}
