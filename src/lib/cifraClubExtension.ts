import { findArtistImage, normalizeCifraUrl, parseCifraPage, type CifraImport } from './cifraClub';

/** ID fixo da versão "carregada sem compactação" (vem da chave pública do manifest.json). */
const unpackedId = 'dcjmmpifkhjfiaopidgmdcdedblgghof';
const configuredId = process.env.NEXT_PUBLIC_CIFRA_EXTENSION_ID?.trim();
const storeId = configuredId && /^[a-p]{32}$/.test(configuredId) ? configuredId : undefined;
/** Tenta a extensão da loja primeiro e depois a de desenvolvimento: funciona com qualquer uma instalada. */
const extensionIds = [...new Set([storeId, unpackedId].filter((id): id is string => !!id))];

export const cifraExtensionInstallUrl = storeId
  ? `https://chromewebstore.google.com/detail/${storeId}`
  : undefined;

type ExtensionResponse = { html: string; url: string } | { error: string };

type ExtensionMessage = { type: 'cifra:import' | 'source:fetch'; url: string } | { type: 'ping' };

type Runtime = {
  sendMessage?: (id: string, message: ExtensionMessage, callback: (response?: any) => void) => void;
  lastError?: { message?: string };
};

const getRuntime = () => (typeof window === 'undefined' ? undefined : (window as Window & { chrome?: { runtime?: Runtime } }).chrome?.runtime);

/** Envia o pedido para uma extensão; undefined quando ela não está instalada (ou não atende este site). */
function ask<T = ExtensionResponse>(runtime: Runtime, id: string, message: ExtensionMessage, timeoutMs = 18000): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const deadline = window.setTimeout(() => reject(new Error('A extensão demorou para responder. Tente novamente.')), timeoutMs);
    try {
      runtime.sendMessage?.(id, message, (result) => {
        window.clearTimeout(deadline);
        // Ler lastError evita o aviso "Unchecked runtime.lastError" no console
        resolve(runtime.lastError ? undefined : result);
      });
    } catch {
      window.clearTimeout(deadline);
      resolve(undefined);
    }
  });
}

/**
 * Extensão que sabe buscar páginas de outras fontes (versão 0.3.0 em diante).
 * Guarda o ID que respondeu; versões antigas não respondem ao "ping".
 */
let fetcherPromise: Promise<string | null> | null = null;
export function findSourceFetcher(): Promise<string | null> {
  const runtime = getRuntime();
  if (!runtime?.sendMessage) return Promise.resolve(null);
  return (fetcherPromise ??= (async () => {
    for (const id of extensionIds) {
      const pong = await ask<{ ok?: boolean; fetch?: boolean }>(runtime, id, { type: 'ping' }, 3000).catch(() => undefined);
      if (pong?.ok && pong.fetch) return id;
    }
    fetcherPromise = null; // tenta de novo depois (ex.: extensão instalada agora)
    return null;
  })());
}

/** HTML bruto de uma página de fonte de cifras, pelo navegador do usuário. undefined sem extensão compatível. */
export async function fetchWithExtension(url: string): Promise<{ html: string; url: string } | undefined> {
  const runtime = getRuntime();
  const id = await findSourceFetcher();
  if (!runtime || !id) return undefined;
  const response = await ask(runtime, id, { type: 'source:fetch', url }, 25000);
  if (!response) return undefined;
  if ('error' in response) throw new Error(response.error);
  return response;
}

export async function importWithCifraExtension(rawUrl: string): Promise<CifraImport | undefined> {
  const runtime = getRuntime();
  if (!runtime?.sendMessage) return undefined;

  const url = normalizeCifraUrl(rawUrl);
  let response: ExtensionResponse | undefined;
  for (const id of extensionIds) {
    response = await ask(runtime, id, { type: 'cifra:import', url });
    if (response) break;
  }

  if (!response) return undefined;
  if ('error' in response) throw new Error(response.error);

  const data = parseCifraPage(response.html, url, normalizeCifraUrl(response.url));
  return { ...data, artistImage: await findArtistImage(data.artist, data.artistSlug, {}) };
}
