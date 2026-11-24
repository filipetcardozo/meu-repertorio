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

type Runtime = {
  sendMessage?: (
    id: string,
    message: { type: 'cifra:import'; url: string },
    callback: (response?: ExtensionResponse) => void,
  ) => void;
  lastError?: { message?: string };
};

/** Envia o pedido para uma extensão; undefined quando ela não está instalada (ou não atende este site). */
function ask(runtime: Runtime, id: string, url: string): Promise<ExtensionResponse | undefined> {
  return new Promise((resolve, reject) => {
    const deadline = window.setTimeout(() => reject(new Error('A extensão demorou para responder. Tente novamente.')), 18000);
    try {
      runtime.sendMessage?.(id, { type: 'cifra:import', url }, (result) => {
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

export async function importWithCifraExtension(rawUrl: string): Promise<CifraImport | undefined> {
  const runtime = (window as Window & { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (!runtime?.sendMessage) return undefined;

  const url = normalizeCifraUrl(rawUrl);
  let response: ExtensionResponse | undefined;
  for (const id of extensionIds) {
    response = await ask(runtime, id, url);
    if (response) break;
  }

  if (!response) return undefined;
  if ('error' in response) throw new Error(response.error);

  const data = parseCifraPage(response.html, url, normalizeCifraUrl(response.url));
  return { ...data, artistImage: await findArtistImage(data.artist, data.artistSlug, {}) };
}
