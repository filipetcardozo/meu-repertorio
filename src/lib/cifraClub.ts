/**
 * Busca e importação de cifras do Cifra Club, com parser compartilhado pelo servidor e pela extensão.
 *
 * - Busca: usa o mesmo endpoint de autocomplete do site (solr.sscdn.co).
 * - Importação: baixa a página da música e extrai o conteúdo do <pre> da cifra,
 *   normalizando para o formato que o app guarda: `<pre>` com acordes em `<b>` e
 *   tablaturas em `<span class="tablatura">` (o modo "sem solo" remove os <span>).
 */

const SEARCH_URL = 'https://solr.sscdn.co/cc/c7/';
const SITE = 'https://www.cifraclub.com.br';
const ALLOWED_HOSTS = new Set(['www.cifraclub.com.br', 'cifraclub.com.br', 'm.cifraclub.com.br']);

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

export type CifraSearchResult = {
  artist: string;
  song: string;
  url: string;
  image?: string;
};

export type CifraStrumming = {
  section: string;
  bpm: number | null;
  /** Grade do compasso, ex.: ["1","x","x","x","2",...] (4 tempos em semicolcheias) */
  timeSignature: string[];
  /** Códigos da batida como o Cifra Club guarda (decodificados na fase do ritmo) */
  pattern: number[];
};

export type CifraImport = {
  artist: string;
  song: string;
  tone: string;
  lyric: string;
  url: string;
  // Metadados (todos opcionais: dependem do que a página traz)
  artistSlug?: string;
  artistImage?: string;
  coverImage?: string;
  genre?: string;
  songwriters?: string[];
  capo?: number;
  tuning?: string;
  bpm?: number;
  beatsPerBar?: number;
  strummings?: CifraStrumming[];
  youtubeId?: string;
  /** Nome da versão importada (ex.: "Principal", "Simplificada") */
  versionLabel?: string;
  /** Versões de cifra que a página destaca (a lista completa fica no site) */
  versions?: CifraVersion[];
};

export type CifraVersion = {
  label: string;
  url: string;
  verified?: boolean;
  /** Em quantas listas de usuários a versão aparece (popularidade) */
  lists?: number;
};

export class CifraError extends Error {
  constructor(message: string, public status = 500, public code?: 'CIFRA_ACCESS_DENIED') {
    super(message);
  }
}

async function fetchWithTimeout(url: string, ms = 10000, headers: HeadersInit = HEADERS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
  } catch (e) {
    throw new CifraError('Não foi possível acessar o Cifra Club.', 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function searchCifraClub(query: string, limit = 10): Promise<CifraSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const res = await fetchWithTimeout(`${SEARCH_URL}?q=${encodeURIComponent(q)}&limit=${limit * 2}`);
  if (!res.ok) throw new CifraError('A busca do Cifra Club falhou.', 502);

  let data: any;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new CifraError('Resposta inesperada da busca do Cifra Club.', 502);
  }

  const docs: any[] = data?.response?.docs ?? [];
  return docs
    .filter((d) => d.tipo === '2' && d.dns && d.url) // tipo 2 = música
    .slice(0, limit)
    .map((d) => ({
      artist: String(d.art ?? ''),
      song: String(d.txt ?? ''),
      url: `${SITE}/${d.dns}/${d.url}/`,
      image: d.imgm || undefined,
    }));
}

/** Aceita só URLs do Cifra Club (evita usar a rota como proxy para qualquer site). */
export function normalizeCifraUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new CifraError('Link inválido.', 400);
  }
  if (!['http:', 'https:'].includes(u.protocol) || !ALLOWED_HOSTS.has(u.hostname)) {
    throw new CifraError('Use um link do cifraclub.com.br.', 400);
  }
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new CifraError('O link precisa ser de uma música (cifraclub.com.br/artista/musica).', 400);
  const [artist, song, ...rest] = parts;
  const safe = /^[a-z0-9-]+$/i;
  if (!safe.test(artist) || !safe.test(song)) throw new CifraError('Link inválido.', 400);
  const base = `${SITE}/${artist}/${song}/`;

  // Versões: /artista/musica/simplificada.html, /artista/musica/u/abcde.html
  if (rest.length === 1 && /^[a-z0-9-]+\.html$/i.test(rest[0]) && rest[0] !== 'imprimir.html') return base + rest[0];
  if (rest.length === 2 && rest[0] === 'u' && /^[a-z0-9-]+\.html$/i.test(rest[1])) return `${base}u/${rest[1]}`;
  if (rest[0] === 'letra' || rest[0] === 'tabspro') throw new CifraError('Esse link não é de cifra (é letra ou Tabs PRO).', 400);
  // "#...", "imprimir.html" etc.: fica a versão principal
  return base;
}

/** Endereço da versão principal (sem a parte da versão). */
export const cifraBaseUrl = (url: string) => {
  const [artist, song] = new URL(url).pathname.split('/').filter(Boolean);
  return `${SITE}/${artist}/${song}/`;
};

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Pega o innerHTML do primeiro <pre> (o da cifra). */
function extractPre(html: string): string | null {
  const start = html.search(/<pre\b[^>]*data-chord-content[^>]*>/i);
  const from = start >= 0 ? start : html.search(/<pre\b/i);
  if (from < 0) return null;
  const openEnd = html.indexOf('>', from);
  const close = html.indexOf('</pre>', openEnd);
  if (openEnd < 0 || close < 0) return null;
  return html.slice(openEnd + 1, close);
}

/** Converte o HTML do <pre> do Cifra Club no formato salvo pelo app. */
export function cleanCifraHtml(inner: string): string {
  let s = inner
    // caracteres invisíveis que o site coloca no começo das linhas
    .replace(/[​-‍﻿]/g, '')
    .replace(/&#8203;|&#x200b;/gi, '')
    // tablaturas
    .replace(/<span\b[^>]*class="[^"]*\btab\b[^"]*"[^>]*>/gi, '<span class="tablatura">')
    // acordes: <b data-...>X</b> -> <b>X</b>
    .replace(/<b\b[^>]*>/gi, '<b>')
    .replace(/<\/?strong\b[^>]*>/gi, (t) => (t.startsWith('</') ? '</b>' : '<b>'))
    // demais spans (sem ser tablatura) e containers de layout somem
    .replace(/<span\b(?![^>]*class="tablatura")[^>]*>/gi, '<span>')
    .replace(/<\/?(div|section|article|p|i|em|a|img|button)\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n?/g, '\n');

  // <span> genéricos sem classe não têm função: remove o par.
  s = s.replace(/<span>([\s\S]*?)<\/span>/g, '$1');

  // Espaços no fim da linha (ex.: "E|----| ") e excesso de linhas em branco.
  s = s
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\s+$/g, '');

  return `<pre>${s}</pre>`;
}

function extractTone(html: string): string {
  const i = html.indexOf('id="key"');
  if (i >= 0) {
    const texts = html
      .slice(i, i + 2000)
      .split(/<[^>]+>/)
      .map((t) => decodeEntities(t).trim())
      .filter(Boolean);
    const k = texts.findIndex((t) => /^tom:?$/i.test(t));
    const tone = k >= 0 ? texts[k + 1] : undefined;
    if (tone && /^[A-G][#b]?m?$/.test(tone)) return tone;
  }
  // Layout antigo: <span id="cifra_tom">tom: <a>F</a></span>
  const old = html.match(/id="cifra_tom"[\s\S]{0,300}?<a[^>]*>\s*([A-G][#b]?m?)\s*</i);
  return old ? old[1] : '';
}

function extractTitle(html: string): { song: string; artist: string } {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  const title = decodeEntities(og?.[1] ?? html.match(/<title>([^<]*)/i)?.[1] ?? '');
  // "Música - Artista - Cifra Club"
  const parts = title.split(' - ').map((p) => p.trim());
  if (parts[parts.length - 1]?.toLowerCase() === 'cifra club') parts.pop();
  const artist = parts.length > 1 ? parts.pop()! : '';
  return { song: parts.join(' - '), artist };
}

/**
 * A página é um app Next.js: os dados da música vêm no payload RSC
 * (`self.__next_f.push([1,"..."])`). Junta os pedaços e devolve o texto decodificado.
 */
function decodeRscPayload(html: string): string {
  let out = '';
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out += JSON.parse(m[1]);
    } catch {
      /* pedaço malformado: ignora */
    }
  }
  return out;
}

/** Lê o objeto JSON que começa em `text[start]` ('{'), respeitando strings. */
function readJsonObject(text: string, start: number): any | null {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const cleanText = (s: unknown) =>
  typeof s === 'string' ? s.replace(/[­​-‍﻿]/g, '').replace(/\s+/g, ' ').trim() : '';

type SongMeta = Omit<CifraImport, 'artist' | 'song' | 'tone' | 'lyric' | 'url' | 'artistImage'> & {
  artistName?: string;
  songName?: string;
};

/** Lê o array JSON que começa em `text[start]` ('['), respeitando strings. */
function readJsonArray(text: string, start: number): any[] | null {
  const wrapped = readJsonObject(`{"v":${text.slice(start, start + 200000)}`, 0);
  return Array.isArray(wrapped?.v) ? wrapped.v : null;
}

function extractVersions(data: any, payload: string, baseUrl: string): CifraVersion[] {
  let list: any[] | null = Array.isArray(data?.metadata?.priorityVersions) ? data.metadata.priorityVersions : null;
  if (!list) {
    const key = '"priorityVersions":';
    const at = payload.indexOf(key);
    list = at >= 0 ? readJsonArray(payload, at + key.length) : null;
  }
  return (list ?? [])
    .filter((v) => v?.instrument?.slug === 'cifra-group' && /^[a-z0-9-]+$/i.test(v?.label?.slug ?? ''))
    .map((v) => ({
      label: cleanText(v.label.name) || v.label.slug,
      url: v.label.slug === 'principal' ? baseUrl : `${baseUrl}${v.label.slug}.html`,
      verified: !!v.metadata?.verified,
      lists: Number.isFinite(v.metadata?.listAppearances) ? v.metadata.listAppearances : undefined,
    }));
}

function extractSongMeta(html: string, url: string): SongMeta {
  const payload = decodeRscPayload(html);
  const key = '"songData":';
  const at = payload.indexOf(key);
  const data = at >= 0 ? readJsonObject(payload, at + key.length) : null;
  if (!data) return {};

  const versions = extractVersions(data, payload, cifraBaseUrl(url));
  const versionLabel = cleanText(data.label?.name) || undefined;

  const strummings: CifraStrumming[] = Array.isArray(data.strummings)
    ? data.strummings.map((s: any) => ({
        section: cleanText(s?.section),
        bpm: Number.isFinite(s?.bpm) && s.bpm > 0 ? s.bpm : null,
        timeSignature: Array.isArray(s?.timeSignature) ? s.timeSignature.map(String) : [],
        pattern: Array.isArray(s?.pattern) ? s.pattern.filter((n: any) => Number.isFinite(n)) : [],
      }))
    : [];
  const first = strummings.find((s) => s.bpm) ?? strummings[0];
  const beats = first?.timeSignature.filter((t) => t !== 'x').length;

  const cover = data.song?.image?.x2 || data.song?.image?.x1;
  const capo = Number(data.config?.capo);
  // A videoaula vem num objeto à parte; só vale se for desta versão da cifra.
  const vKey = '"videoLesson":';
  const vAt = payload.indexOf(vKey);
  const video = data.videoLesson ?? (vAt >= 0 ? readJsonObject(payload, vAt + vKey.length) : null);
  const sameVersion = !video?.version?.id || !data.id || video.version.id === data.id;
  const youtubeId = sameVersion ? video?.youtubeID : undefined;

  return {
    artistName: cleanText(data.artist?.name) || undefined,
    artistSlug: cleanText(data.artist?.slug) || undefined,
    songName: cleanText(data.song?.name) || undefined,
    genre: cleanText(data.artist?.genre?.name) || undefined,
    songwriters: Array.isArray(data.composers) ? data.composers.map(cleanText).filter(Boolean) : undefined,
    coverImage: typeof cover === 'string' && cover.startsWith('https://') ? cover : undefined,
    capo: Number.isFinite(capo) ? capo : undefined,
    tuning: cleanText(data.config?.tuning) || undefined,
    bpm: first?.bpm ?? undefined,
    beatsPerBar: beats || undefined,
    strummings: strummings.length ? strummings : undefined,
    youtubeId: typeof youtubeId === 'string' && /^[\w-]{6,20}$/.test(youtubeId) ? youtubeId : undefined,
    versionLabel,
    versions: versions.length ? versions : undefined,
  };
}

/** Foto do artista: o autocomplete devolve o próprio artista (tipo 1) com a foto. */
export async function findArtistImage(artistName: string, slug?: string, headers: HeadersInit = HEADERS): Promise<string | undefined> {
  if (!artistName) return undefined;
  try {
    const res = await fetchWithTimeout(`${SEARCH_URL}?q=${encodeURIComponent(artistName)}&limit=10`, 6000, headers);
    if (!res.ok) return undefined;
    const docs: any[] = JSON.parse(await res.text())?.response?.docs ?? [];
    const artistDoc =
      docs.find((d) => d.tipo === '1' && (!slug || d.dns === slug)) ??
      docs.find((d) => d.dns === slug && String(d.imgm ?? '').includes('/fotos/'));
    const img = artistDoc?.imgm;
    return typeof img === 'string' && img.startsWith('https://') ? img : undefined;
  } catch {
    return undefined; // foto é opcional: não derruba a importação
  }
}

export function parseCifraPage(html: string, url: string, pageUrl = url): CifraImport {
  const pre = extractPre(html);
  if (!pre) throw new CifraError('Essa página não tem cifra (só letra?).', 422);

  const title = extractTitle(html);
  const { artistName, songName, ...meta } = extractSongMeta(html, pageUrl);
  const artist = artistName || title.artist;
  const artistSlug = meta.artistSlug ?? new URL(url).pathname.split('/').filter(Boolean)[0];

  return {
    url,
    song: songName || title.song,
    artist,
    tone: extractTone(html),
    lyric: cleanCifraHtml(pre),
    ...meta,
    artistSlug,
  };
}

export async function importFromCifraClub(rawUrl: string): Promise<CifraImport> {
  const url = normalizeCifraUrl(rawUrl);
  const res = await fetchWithTimeout(url);
  if (res.status === 404) throw new CifraError('Música não encontrada no Cifra Club.', 404);
  if (!res.ok) {
    throw new CifraError(
      `O Cifra Club recusou o acesso (${res.status}).`,
      502,
      res.status === 403 ? 'CIFRA_ACCESS_DENIED' : undefined,
    );
  }

  const data = parseCifraPage(await res.text(), url, res.url || url);
  return { ...data, artistImage: await findArtistImage(data.artist, data.artistSlug) };
}
