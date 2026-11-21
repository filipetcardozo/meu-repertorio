/**
 * Acordes da música, na ordem em que aparecem na cifra, e como tocá-los
 * (mesmo som do card de acorde: primeira digitação/inversão do instrumento escolhido).
 */
import { cleanChordToken, parseChord } from './parseChord';
import { generateVoicings } from './voicings';
import { generateKeyboardVoicings } from './keyboardVoicings';
import { getInstrument } from './instruments';
import { playFretted, playKeyboard } from './chordAudio';

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

/** Toca o acorde pelo nome. Retorna false se não souber tocá-lo. */
export function playChordByName(name: string, instrumentId: string): boolean {
  const parsed = parseChord(name);
  if (!parsed) return false;
  const instrument = getInstrument(instrumentId);
  if (instrument.kind === 'keyboard') {
    const v = generateKeyboardVoicings(parsed)[0];
    if (!v) return false;
    playKeyboard(v.notes, v.bass);
    return true;
  }
  const v = generateVoicings(parsed, instrument, 1)[0];
  if (!v) return false;
  playFretted(instrument, v.frets);
  return true;
}
