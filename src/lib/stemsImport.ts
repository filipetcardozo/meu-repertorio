/**
 * Faixas prontas (ex.: exportadas do Moises) para importar como playback: abre o .zip no navegador e
 * descobre pelo nome do arquivo qual instrumento é cada faixa.
 *
 * O Moises exporta um arquivo por faixa (às vezes num .zip), com o nome do instrumento no fim do nome
 * do arquivo ("Musica - Vocals.flac", "drums.wav"...). Nome que não reconhecemos vira uma faixa com o
 * próprio nome do arquivo: dá para importar qualquer separação, não só as 6 do Demucs.
 */

export type StemFile = {
  file: File;
  /** Chave da faixa (vocals, drums, ... ou o nome do arquivo simplificado). */
  name: string;
  /** Nome para mostrar. */
  label: string;
};

/** Máximo por arquivo (FLAC/WAV de uma faixa de 5-6 min cabe com folga). */
export const MAX_STEM_BYTES = 150 * 1024 * 1024;
export const MAX_STEMS = 16;

const AUDIO_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', opus: 'audio/ogg', aif: 'audio/aiff', aiff: 'audio/aiff',
};

export const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase();
export const isAudioName = (name: string) => extOf(name) in AUDIO_EXT;
/** Tipo do arquivo pela extensão (arquivos tirados do .zip vêm sem tipo; o Storage exige audio/*). */
export const audioContentType = (name: string, type?: string) =>
  (type && type.startsWith('audio/') ? type : AUDIO_EXT[extOf(name)] || 'audio/mpeg');

// ---------------------------------------------------------------------------------------------
// Nome do arquivo -> instrumento
// ---------------------------------------------------------------------------------------------

/**
 * Em ordem: o primeiro que casar vale (os mais específicos antes: "backing vocals" antes de "vocals",
 * "acoustic guitar" antes de "guitar", "instrumental" / "no vocals" antes de "vocals").
 */
const RULES: { name: string; label: string; re: RegExp }[] = [
  { name: 'instrumental', label: 'Instrumental', re: /\b(instrumental|accompaniment|acompanhamento|no ?vocals?|sem ?voz|karaoke)\b/ },
  { name: 'backing_vocals', label: 'Backing vocal', re: /\b(backing ?vocals?|backing ?vox|backing|back ?vocals?|bvs?|coro|choir|harmon(y|ies)|segunda voz)\b/ },
  { name: 'lead_vocals', label: 'Voz principal', re: /\b(lead ?vocals?|lead ?voice|voz principal|main ?vocals?)\b/ },
  { name: 'vocals', label: 'Voz', re: /\b(vocals?|voices?|voz|vozes|vox|singer|canto)\b/ },
  { name: 'kick', label: 'Bumbo', re: /\b(kick|bumbo|bass ?drum)\b/ },
  { name: 'snare', label: 'Caixa', re: /\b(snare|caixa)\b/ },
  { name: 'toms', label: 'Tons', re: /\b(toms|tom toms?)\b/ },
  { name: 'hihat', label: 'Chimbal', re: /\b(hi ?hats?|chimbal)\b/ },
  { name: 'cymbals', label: 'Pratos', re: /\b(cymbals?|pratos|overheads?)\b/ },
  { name: 'percussion', label: 'Percussão', re: /\b(percussion|percussao)\b/ },
  { name: 'drums', label: 'Bateria', re: /\b(drums?|bateria|drumkit)\b/ },
  { name: 'bass', label: 'Baixo', re: /\b(bass|baixo)\b/ },
  { name: 'acoustic_guitar', label: 'Violão', re: /\b(acoustic ?guitars?|violao|violoes|acoustic)\b/ },
  { name: 'electric_guitar', label: 'Guitarra elétrica', re: /\b(electric ?guitars?|guitarra eletrica)\b/ },
  { name: 'guitar', label: 'Guitarra', re: /\b(guitars?|guitarras?)\b/ },
  { name: 'piano', label: 'Piano', re: /\b(piano)\b/ },
  { name: 'keys', label: 'Teclado', re: /\b(keys|keyboards?|teclados?|synths?|sintetizador|organ|orgao)\b/ },
  { name: 'strings', label: 'Cordas', re: /\b(strings|cordas|violins?|cellos?|orchestra|orquestra)\b/ },
  { name: 'wind', label: 'Sopros', re: /\b(wind|winds|sopros?|brass|metais|horns?|sax(ophone)?|trumpets?)\b/ },
  { name: 'click', label: 'Metrônomo', re: /\b(click|metronome|metronomo)\b/ },
  { name: 'other', label: 'Outros', re: /\b(other|others|outros?|rest|resto)\b/ },
];

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function cleanBase(fileName: string): string {
  const base = fileName.split('/').pop()!.replace(/\.[^.]+$/, '');
  return base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Instrumento pelo nome do arquivo. Vale o termo mais à direita (o instrumento vem depois do título, e o
 * título pode ter "voz"); empatados no fim, o termo mais longo ("backing vocals" ganha de "vocals").
 */
export function detectStem(fileName: string): { name: string; label: string } {
  const base = cleanBase(fileName);
  const words = plain(base).replace(/[^a-z0-9]+/g, ' ').trim();
  let best: { rule: (typeof RULES)[number]; start: number; end: number } | null = null;
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, 'g');
    let last: RegExpExecArray | null = null;
    for (let m = re.exec(words); m; m = re.exec(words)) last = m;
    if (!last) continue;
    const start = last.index;
    const end = start + last[0].length;
    if (!best || end > best.end || (end === best.end && start < best.start)) best = { rule, start, end };
  }
  if (best) return { name: best.rule.name, label: best.rule.label };
  const slug = words.replace(/\s+/g, '_').slice(0, 40) || 'faixa';
  return { name: slug, label: base.slice(0, 40) || 'Faixa' };
}

/** Faixas na ordem do mixer (voz primeiro, como no Demucs) e com nomes únicos. */
export function toStemFiles(files: File[]): StemFile[] {
  const order = RULES.map((r) => r.name);
  const rank = (n: string) => { const i = order.indexOf(n); return i < 0 ? order.length : i; };
  const first = ['vocals', 'lead_vocals', 'backing_vocals', 'drums', 'bass', 'guitar'];
  const prio = (n: string) => { const i = first.indexOf(n); return i < 0 ? first.length + rank(n) : i; };
  const list = files.map((file) => ({ file, ...detectStem(file.name) }));
  list.sort((a, b) => prio(a.name) - prio(b.name) || a.file.name.localeCompare(b.file.name));
  const seen = new Map<string, number>();
  return list.map((s) => {
    const n = (seen.get(s.name) ?? 0) + 1;
    seen.set(s.name, n);
    return n === 1 ? s : { ...s, name: `${s.name}_${n}`, label: `${s.label} ${n}` };
  });
}

// ---------------------------------------------------------------------------------------------
// .zip (sem biblioteca: lê o diretório central e descompacta com o DecompressionStream do navegador)
// ---------------------------------------------------------------------------------------------

export const isZip = (f: File) => extOf(f.name) === 'zip' || /zip/.test(f.type);

async function bytes(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

/** Arquivos de áudio dentro de um .zip (ignora pastas e arquivos de sistema do macOS). */
export async function unzipAudio(zip: File): Promise<File[]> {
  const tailLen = Math.min(zip.size, 65557);
  const tail = await bytes(zip.slice(zip.size - tailLen));
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${zip.name}: não é um .zip válido.`);
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff) throw new Error(`${zip.name}: .zip grande demais (zip64). Extraia e envie os arquivos.`);
  const cd = await bytes(zip.slice(cdOffset, cdOffset + cdSize));
  const dec = new TextDecoder();
  const out: File[] = [];
  let p = 0;
  for (let k = 0; k < count && p + 46 <= cd.byteLength; k++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const method = cd.getUint16(p + 10, true);
    const csize = cd.getUint32(p + 20, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const local = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const base = name.split('/').pop() || '';
    if (!base || name.endsWith('/') || name.startsWith('__MACOSX/') || base.startsWith('.') || !isAudioName(base)) continue;
    const lh = await bytes(zip.slice(local, local + 30));
    if (lh.getUint32(0, true) !== 0x04034b50) continue;
    const start = local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const raw = zip.slice(start, start + csize);
    let data: Blob;
    if (method === 0) data = raw;
    else if (method === 8) data = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    else throw new Error(`${base}: compressão do .zip não suportada. Extraia e envie os arquivos.`);
    out.push(new File([data], base, { type: audioContentType(base) }));
  }
  return out;
}

/** Arquivos escolhidos (áudio e/ou .zip) -> faixas. */
export async function collectStemFiles(picked: File[]): Promise<StemFile[]> {
  const files: File[] = [];
  for (const f of picked) {
    if (isZip(f)) files.push(...(await unzipAudio(f)));
    else if (isAudioName(f.name) || f.type.startsWith('audio/')) files.push(f);
  }
  if (!files.length) throw new Error('Nenhum arquivo de áudio (mp3, wav, flac, m4a, ogg) encontrado.');
  if (files.length > MAX_STEMS) throw new Error(`São ${files.length} faixas; o máximo é ${MAX_STEMS}.`);
  const big = files.find((f) => f.size > MAX_STEM_BYTES);
  if (big) throw new Error(`${big.name} passa de ${MAX_STEM_BYTES / 1024 / 1024} MB.`);
  return toStemFiles(files);
}
