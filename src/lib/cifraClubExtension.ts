import { findArtistImage, normalizeCifraUrl, parseCifraPage, type CifraImport } from './cifraClub';

const unpackedId = 'dcjmmpifkhjfiaopidgmdcdedblgghof';
const configuredId = process.env.NEXT_PUBLIC_CIFRA_EXTENSION_ID?.trim();
const storeId = configuredId && /^[a-p]{32}$/.test(configuredId) ? configuredId : undefined;
const extensionId = storeId || unpackedId;

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

export async function importWithCifraExtension(rawUrl: string): Promise<CifraImport | undefined> {
  const runtime = (window as Window & { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (!runtime?.sendMessage) return undefined;

  const url = normalizeCifraUrl(rawUrl);
  const response = await new Promise<ExtensionResponse | undefined>((resolve, reject) => {
    const deadline = window.setTimeout(() => reject(new Error('A extensão demorou para responder. Tente novamente.')), 18000);
    try {
      runtime.sendMessage?.(extensionId, { type: 'cifra:import', url }, (result) => {
        window.clearTimeout(deadline);
        resolve(runtime.lastError ? undefined : result);
      });
    } catch {
      window.clearTimeout(deadline);
      resolve(undefined);
    }
  });

  if (!response) return undefined;
  if ('error' in response) throw new Error(response.error);

  const data = parseCifraPage(response.html, url, normalizeCifraUrl(response.url));
  return { ...data, artistImage: await findArtistImage(data.artist, data.artistSlug, {}) };
}
