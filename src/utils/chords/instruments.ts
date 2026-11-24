/**
 * Instrumentos disponíveis no desenho dos acordes. Para adicionar um novo, basta incluir aqui:
 * - instrumento de cordas com trastes: o gerador de digitações funciona para qualquer afinação;
 * - teclado: as variações são as inversões do acorde.
 */

export type FrettedInstrument = {
  kind: 'fretted';
  id: string;
  name: string;
  /** Afinação em MIDI, da corda que fica à esquerda no diagrama para a da direita. */
  tuning: number[];
  /** Nome de cada corda, na mesma ordem de `tuning`. */
  stringNames: string[];
  /** Último traste considerado. */
  maxFret: number;
  /** Maior distância entre o traste mais baixo e o mais alto pressionados. */
  maxSpan: number;
  /** Se a nota mais grave precisa ser o baixo do acorde (raiz ou baixo invertido). */
  bassMustMatch: boolean;
  /** Se pode deixar cordas sem tocar (x). */
  allowMutedStrings: boolean;
  /** Mínimo de cordas soando. */
  minSoundingStrings: number;
  /** Proporções do desenho, baseadas no braço real do instrumento. */
  diagram: {
    /** Distância entre cordas (px). */
    stringGap: number;
    /** Altura da 1ª casa exibida (px); as seguintes diminuem como no braço real. */
    fretGap: number;
    /** Espessura de cada corda (px), mesma ordem de `tuning`. */
    stringGauges: number[];
  };
  /** Timbre do som sintetizado (corda dedilhada), usado enquanto as gravações não carregam. */
  sound: PluckSound;
  /** Gravações do instrumento (ver utils/audio/samples). */
  samples?: NoteBankId;
  /**
   * Ajuste do timbre das gravações para o instrumento soar como ele mesmo quando usa as de outro
   * (ex.: cavaco e banjo usam o violão de aço): quanto a nota dura (s, constante de queda),
   * brilho e ressonâncias do corpo.
   */
  sampleTone?: { decay?: number; bright?: number; body?: { hz: number; q: number; db: number }[] };
};

import type { NoteBankId } from '../audio/samples';

export type PluckSound = {
  /** Quanto tempo a corda soa (s). */
  sustain: number;
  /** 0 = ataque brilhante (aço), perto de 1 = ataque macio (nylon). */
  softness: number;
  /** Corte de agudos (Hz): nylon é mais "redondo", aço mais brilhante. */
  lowpassHz: number;
  /** Intervalo entre as cordas na batida (ms). */
  strumMs: number;
  /** Ponto onde a corda é tocada (fração do comprimento): perto da ponte = mais brilhante. */
  pluckPosition: number;
  /** Ressonâncias do corpo do instrumento (filtros de pico). */
  body: { hz: number; q: number; db: number }[];
  /** Quanto de reverb (sala) vai junto, 0..1. */
  reverb: number;
  /** Barulhinho da palheta no ataque, 0..1 (cavaco é tocado de palheta). */
  pickNoise: number;
};

export type KeyboardInstrument = {
  kind: 'keyboard';
  id: string;
  name: string;
};

export type Instrument = FrettedInstrument | KeyboardInstrument;

export const INSTRUMENTS: Instrument[] = [
  {
    kind: 'fretted',
    id: 'guitar',
    name: 'Violão',
    tuning: [40, 45, 50, 55, 59, 64], // E A D G B E
    stringNames: ['E', 'A', 'D', 'G', 'B', 'E'],
    maxFret: 15,
    maxSpan: 3,
    bassMustMatch: true,
    allowMutedStrings: true,
    minSoundingStrings: 4,
    // Pestana ~43 mm com 6 cordas; casas longas (escala ~650 mm). Bordões mais grossos.
    diagram: { stringGap: 20, fretGap: 30, stringGauges: [2.4, 2.0, 1.7, 1.3, 1.0, 0.8] },
    // Nylon tocado com os dedos; caixa grande ressoa nos graves (~100 Hz ar, ~200 Hz tampo).
    sound: {
      sustain: 3.2, softness: 0.55, lowpassHz: 4200, strumMs: 30, pluckPosition: 0.14,
      body: [{ hz: 105, q: 1.4, db: 5 }, { hz: 210, q: 1.2, db: 3 }, { hz: 2600, q: 0.9, db: 2 }],
      reverb: 0.22, pickNoise: 0,
    },
    samples: 'violao',
  },
  {
    kind: 'fretted',
    id: 'cavaquinho',
    name: 'Cavaquinho',
    tuning: [62, 67, 71, 74], // D G B D
    stringNames: ['D', 'G', 'B', 'D'],
    maxFret: 15,
    maxSpan: 3,
    // No cavaco o baixo fica com outros instrumentos; a nota mais grave pode ser terça ou quinta.
    bassMustMatch: false,
    allowMutedStrings: false,
    minSoundingStrings: 4,
    // Pestana ~30 mm com 4 cordas (braço ~70% do violão); cordas de aço finas.
    diagram: { stringGap: 23, fretGap: 30, stringGauges: [1.3, 1.1, 0.9, 0.8] },
    // Aço tocado de palheta: brilhante, curto, caixa pequena (ressonância mais aguda).
    sound: {
      sustain: 1.9, softness: 0.12, lowpassHz: 9500, strumMs: 16, pluckPosition: 0.09,
      body: [{ hz: 320, q: 1.5, db: 4 }, { hz: 3400, q: 1, db: 3 }],
      reverb: 0.18, pickNoise: 0.35,
    },
    // Não há cavaquinho gravado com licença livre: violão de aço na região aguda, mais curto e
    // com o "estalo" da caixa pequena.
    samples: 'aco',
    sampleTone: { decay: 0.55, bright: 1.25, body: [{ hz: 3000, q: 1.2, db: 4 }, { hz: 220, q: 1, db: -4 }] },
  },
  {
    kind: 'fretted',
    id: 'ukulele',
    name: 'Ukulele',
    // Afinação padrão G C E A com o G agudo (reentrante): a corda da esquerda não é a mais grave.
    tuning: [67, 60, 64, 69],
    stringNames: ['G', 'C', 'E', 'A'],
    maxFret: 12,
    maxSpan: 3,
    bassMustMatch: false,
    allowMutedStrings: false,
    minSoundingStrings: 4,
    // Pestana ~35 mm com 4 cordas; cordas de nylon, a do C é a mais grossa.
    diagram: { stringGap: 25, fretGap: 30, stringGauges: [1.2, 1.7, 1.4, 1.1] },
    // Nylon com os dedos, corpo pequeno: som doce e curto.
    sound: {
      sustain: 1.7, softness: 0.5, lowpassHz: 5200, strumMs: 22, pluckPosition: 0.2,
      body: [{ hz: 260, q: 1.5, db: 4 }, { hz: 1900, q: 1, db: 2 }],
      reverb: 0.2, pickNoise: 0,
    },
    // Ukulele também é de nylon: usa as gravações do violão, na região aguda, mais curto e doce.
    samples: 'violao',
    sampleTone: { decay: 0.7, bright: 0.9, body: [{ hz: 300, q: 1.2, db: 3 }, { hz: 140, q: 1, db: -5 }] },
  },
  {
    kind: 'keyboard',
    id: 'keyboard',
    name: 'Teclado',
  },
];

export const DEFAULT_INSTRUMENT_ID = INSTRUMENTS[0].id;

export function getInstrument(id: string | null | undefined): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}
