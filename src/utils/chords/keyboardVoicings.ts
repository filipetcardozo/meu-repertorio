/**
 * Variações de um acorde no teclado: posição fundamental e inversões (mão direita),
 * com o baixo invertido (ex.: G/B) na mão esquerda.
 */
import type { ParsedChord } from './parseChord';

export type KeyboardVoicing = {
  /** Notas da mão direita (MIDI, em ordem crescente). */
  notes: number[];
  /** Nota da mão esquerda, quando o acorde tem baixo invertido. */
  bass: number | null;
  /** 0 = posição fundamental, 1 = 1ª inversão... */
  inversion: number;
};

/** Faixa onde a nota mais grave da mão direita fica (perto do dó central). */
const RIGHT_HAND_LOW = 57; // A3
const RIGHT_HAND_HIGH = 68; // G#4

/**
 * Empilha os intervalos como se toca: terça, quinta e sétima dentro da oitava,
 * extensões (9ª, 11ª, 13ª) por cima.
 */
function stackIntervals(chord: ParsedChord): number[] {
  const all = [...new Set([...chord.required, ...chord.optional])];
  const hasThird = all.includes(3) || all.includes(4);
  const hasSeventh = all.includes(10) || all.includes(11);
  const hasFifth = all.some((i) => i === 6 || i === 7 || i === 8);

  return all
    .map((i) => {
      if (!hasThird) return i; // sus2 / sus4 / power chord: ficam no lugar da terça
      if (i === 1 || i === 2 || i === 3 && all.includes(4)) return i + 12; // b9, 9, #9
      if (i === 5) return 17; // 11
      if (i === 6 && hasFifth && all.includes(7)) return 18; // #11
      if (i === 9 && hasSeventh) return 21; // 13
      if (i === 8 && all.includes(7)) return 20; // b13
      return i;
    })
    .sort((a, b) => a - b);
}

function placeInRange(intervals: number[], root: number): number[] {
  // root é a classe (0..11); escolhe a oitava para a nota mais grave cair perto do dó central
  let base = 48 + root + intervals[0];
  while (base < RIGHT_HAND_LOW) base += 12;
  while (base > RIGHT_HAND_HIGH) base -= 12;
  return intervals.map((i) => base + (i - intervals[0]));
}

export function generateKeyboardVoicings(chord: ParsedChord): KeyboardVoicing[] {
  const stacked = stackIntervals(chord);
  // Inversões só giram as notas "de base" (até a sétima); extensões continuam por cima.
  const core = stacked.filter((i) => i < 12);
  const ext = stacked.filter((i) => i >= 12);

  const voicings: KeyboardVoicing[] = [];
  for (let inv = 0; inv < core.length; inv++) {
    const rotated = [...core.slice(inv), ...core.slice(0, inv).map((i) => i + 12)];
    // Extensões logo acima da 2ª nota (ex.: C E G + D → C E G D; G Bb C E + D → G Bb C D E),
    // sem ficarem muito longe da mão.
    const floor = rotated[Math.min(1, rotated.length - 1)];
    const extras = ext.map((e) => { let v = e % 12; while (v <= floor) v += 12; return v; });
    const notes = placeInRange([...rotated, ...extras].sort((a, b) => a - b), chord.root);

    let bass: number | null = null;
    if (chord.hasSlashBass) {
      // Mão esquerda: o baixo uma oitava (ou menos) abaixo da mão direita
      bass = notes[0] - 1;
      while (((bass % 12) + 12) % 12 !== chord.bass) bass--;
      if (notes[0] - bass < 5) bass -= 12;
    }
    voicings.push({ notes, bass, inversion: inv });
  }

  // Com baixo invertido, a inversão que já começa pelo baixo soa mais natural: vem primeiro.
  if (chord.hasSlashBass) {
    const i = voicings.findIndex((v) => ((v.notes[0] % 12) + 12) % 12 === chord.bass);
    if (i > 0) voicings.unshift(...voicings.splice(i, 1));
  }
  return voicings;
}

export function inversionLabel(inv: number): string {
  return inv === 0 ? 'Posição fundamental' : `${inv}ª inversão`;
}
