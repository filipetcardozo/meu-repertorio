import React from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import type { KeyboardVoicing } from '../../utils/chords/keyboardVoicings';

type Props = {
  voicing: KeyboardVoicing;
  /** Nomes das notas com bemol (Bb) em vez de sustenido (A#). */
  preferFlats?: boolean;
  /** Largura máxima disponível (px). */
  maxWidth?: number;
};

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const MIN_WHITE_KEYS = 10;

// Proporções reais: tecla branca ~23,5 × 150 mm; preta ~13,7 × 95 mm.
// A altura é encurtada para caber no card, mas preta/branca mantém a relação real.
const WHITE_RATIO = 5.2;
const BLACK_WIDTH = 0.58;
const BLACK_HEIGHT = 0.63;

const pc = (midi: number) => ((midi % 12) + 12) % 12;

export function noteName(midi: number, preferFlats = false) {
  return (preferFlats ? FLATS : SHARPS)[pc(midi)];
}

/** Teclado com as teclas do acorde marcadas (mão direita na cor do acorde, baixo em outra cor). */
export function KeyboardDiagram({ voicing, preferFlats = false, maxWidth = 210 }: Props) {
  const theme = useTheme();
  const all = voicing.bass != null ? [voicing.bass, ...voicing.notes] : voicing.notes;

  // Começa num C ou F e termina num E ou B, para o desenho não cortar um grupo de pretas.
  let start = Math.min(...all);
  while (BLACK.has(pc(start)) || (pc(start) !== 0 && pc(start) !== 5)) start--;
  let end = Math.max(...all);
  while (BLACK.has(pc(end)) || (pc(end) !== 4 && pc(end) !== 11)) end++;

  const whites: number[] = [];
  for (let m = start; m <= end; m++) if (!BLACK.has(pc(m))) whites.push(m);
  while (whites.length < MIN_WHITE_KEYS) {
    let m = whites[whites.length - 1] + 1;
    while (BLACK.has(pc(m))) m++;
    whites.push(m);
  }
  const last = whites[whites.length - 1];

  const whiteW = Math.min(18, (maxWidth - 2) / whites.length);
  const whiteH = whiteW * WHITE_RATIO;
  const blackW = whiteW * BLACK_WIDTH;
  const blackH = whiteH * BLACK_HEIGHT;
  const width = whites.length * whiteW + 2;
  const labelH = 12;
  const height = whiteH + labelH + 2;

  const whiteIndex = new Map(whites.map((m, i) => [m, i]));
  const keyCenterX = (m: number) => {
    if (!BLACK.has(pc(m))) return 1 + (whiteIndex.get(m)! + 0.5) * whiteW;
    return 1 + whiteIndex.get(m + 1)! * whiteW; // preta fica na divisa com a branca seguinte
  };

  const right = new Set(voicing.notes);
  const isBass = (m: number) => voicing.bass === m;
  const hand = theme.palette.chord.main;
  const bassColor = theme.palette.info.main;
  const keyStroke = alpha('#000', 0.55);

  const blacks: number[] = [];
  for (let m = start; m <= last; m++) if (BLACK.has(pc(m)) && whiteIndex.has(m + 1)) blacks.push(m);

  const marker = (m: number, isBlack: boolean) => {
    const used = right.has(m) || isBass(m);
    if (!used) return null;
    const r = Math.min(whiteW * 0.3, 5);
    const cy = isBlack ? blackH - r - 3 : whiteH - r - 4;
    return (
      <circle
        key={`k${m}`}
        cx={keyCenterX(m)}
        cy={cy}
        r={r}
        fill={isBass(m) ? bassColor : hand}
        stroke={isBlack ? '#fff' : 'none'}
        strokeWidth={isBlack ? 1 : 0}
      />
    );
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role='img'
      aria-label={`Teclas: ${all.map((m) => noteName(m, preferFlats)).join(' ')}`}
      style={{ display: 'block', fontFamily: theme.typography.fontFamily }}
    >
      {/* brancas */}
      {whites.map((m, i) => {
        const used = right.has(m) || isBass(m);
        return (
          <g key={`w${m}`}>
            <rect x={1 + i * whiteW} y={1} width={whiteW} height={whiteH} rx={2} fill='#f5f5f7' stroke={keyStroke} strokeWidth={1} />
            {/* tecla tocada: cor clara por cima do branco */}
            {used && (
              <rect
                x={1 + i * whiteW + 0.5} y={1.5} width={whiteW - 1} height={whiteH - 1} rx={2}
                fill={alpha(isBass(m) ? bassColor : hand, 0.3)}
              />
            )}
          </g>
        );
      })}
      {whites.map((m) => marker(m, false))}

      {/* pretas */}
      {blacks.map((m) => {
        const used = right.has(m) || isBass(m);
        return (
          <rect
            key={`b${m}`}
            x={keyCenterX(m) - blackW / 2}
            y={1}
            width={blackW}
            height={blackH}
            rx={1.5}
            fill={used ? (isBass(m) ? theme.palette.info.dark : theme.palette.chord.dark) : '#1c1c21'}
            stroke={keyStroke}
            strokeWidth={1}
          />
        );
      })}
      {blacks.map((m) => marker(m, true))}

      {/* referência: posição dos dós */}
      {whites.filter((m) => pc(m) === 0).map((m) => (
        <text
          key={`c${m}`}
          x={keyCenterX(m)}
          y={whiteH + labelH}
          textAnchor='middle'
          fontSize={9}
          fill={theme.palette.text.secondary}
        >
          C{Math.floor(m / 12) - 1}
        </text>
      ))}
    </svg>
  );
}
