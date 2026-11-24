/**
 * Acordes da música, na ordem em que aparecem na cifra, e como tocá-los
 * (mesmo som do card de acorde: primeira digitação/inversão do instrumento escolhido).
 */
import { cleanChordToken, parseChord } from './parseChord';
import { generateVoicings } from './voicings';
import { generateKeyboardVoicings } from './keyboardVoicings';
import { getInstrument } from './instruments';
import { playFretted, playKeyboard, type StrokeOptions } from './chordAudio';
import { BAND_ONLY_INSTRUMENTS } from './band';

/** Lê os acordes (<b> da cifra exibida, já transpostos) na ordem da música. */
export function songChordSequence(root: HTMLElement | null): string[] {
  if (!root) return [];
  const out: string[] = [];
  root.querySelectorAll('[data-lyric-body] b, [data-lyric-body] strong').forEach((b) => {
    (b.textContent ?? '').split(/\s+/).forEach((raw) => {
      const name = cleanChordToken(raw);
      if (name && parseChord(name)) out.push(name);
    });
  });
  return out;
}

/**
 * Toca o acorde pelo nome. Retorna false se não souber tocá-lo.
 * `opts` escolhe o toque: batida para cima, só o baixo, abafado, agendado etc. (ver `StrokeOptions`).
 */
export function playChordByName(name: string, instrumentId: string, opts: StrokeOptions = {}): boolean {
  const parsed = parseChord(name);
  if (!parsed) return false;
  const instrument = BAND_ONLY_INSTRUMENTS.find((i) => i.id === instrumentId) ?? getInstrument(instrumentId);
  if (instrument.kind === 'keyboard') {
    const v = generateKeyboardVoicings(parsed)[0];
    if (!v) return false;
    playKeyboard(v.notes, v.bass, opts);
    return true;
  }
  const v = voicingCache.get(`${instrument.id}:${name}`) ?? generateVoicings(parsed, instrument, 1)[0];
  if (!v) return false;
  voicingCache.set(`${instrument.id}:${name}`, v);
  playFretted(instrument, v.frets, opts);
  return true;
}

// O ritmo toca o mesmo acorde várias vezes por tempo: guarda a digitação em vez de gerar de novo.
const voicingCache = new Map<string, { frets: number[] }>();
