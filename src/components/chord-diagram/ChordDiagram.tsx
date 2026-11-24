import React from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import type { FrettedInstrument } from '../../utils/chords/instruments';
import type { Voicing } from '../../utils/chords/voicings';

type Props = {
  voicing: Voicing;
  instrument: FrettedInstrument;
};

const PAD_X = 30;      // espaço lateral (cabe o "12ª" à esquerda)
const TOP = 26;        // espaço para os ○ / × acima da pestana
const BOTTOM = 24;     // nomes das cordas
const MIN_ROWS = 4;
/** Cada casa é ~5,6% menor que a anterior (razão 2^(-1/12)), como no braço real. */
const FRET_TAPER = Math.pow(2, -1 / 12);
const INLAYS = [3, 5, 7, 9, 15];
const DOUBLE_INLAY = 12;

/** Os dedos "pulam" no braço um depois do outro (da corda grave para a aguda). */
const DOT_DELAY_MS = 90;
const DOT_STAGGER_MS = 35;
const DOT_STYLE = `
@keyframes chord-dot-pop {
  0% { opacity: 0; transform: scale(0.2); }
  65% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes chord-barre-grow {
  from { opacity: 0; transform: scaleX(0.1); }
  to { opacity: 1; transform: scaleX(1); }
}
.chord-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: chord-dot-pop 260ms cubic-bezier(.3, .7, .4, 1) backwards;
}
.chord-barre {
  transform-box: fill-box;
  transform-origin: left center;
  animation: chord-barre-grow 240ms 60ms cubic-bezier(.2, .8, .3, 1) backwards;
}
@media (prefers-reduced-motion: reduce) {
  .chord-dot, .chord-barre { animation: none; }
}
`;

/** Diagrama vertical: cordas graves à esquerda, casas de cima para baixo. */
export function ChordDiagram({ voicing, instrument }: Props) {
  const theme = useTheme();
  const { frets, fingers, barre } = voicing;
  const { stringGap, fretGap, stringGauges } = instrument.diagram;
  const n = frets.length;

  const pressed = frets.filter((f) => f > 0);
  const highest = pressed.length ? Math.max(...pressed) : 0;
  const lowest = pressed.length ? Math.min(...pressed) : 0;
  const baseFret = highest <= MIN_ROWS ? 1 : lowest;
  const rows = Math.max(MIN_ROWS, highest - baseFret + 1);

  // Posição de cada traste (linha), com as casas diminuindo
  const fretY: number[] = [TOP];
  for (let r = 0; r < rows; r++) fretY.push(fretY[r] + fretGap * Math.pow(FRET_TAPER, r));
  const boardBottom = fretY[rows];

  const gridW = stringGap * (n - 1);
  const width = gridW + PAD_X * 2;
  const height = boardBottom + BOTTOM;
  const x = (s: number) => PAD_X + s * stringGap;
  const centerX = PAD_X + gridW / 2;
  const rowOf = (fret: number) => fret - baseFret;
  const yDot = (fret: number) => (fretY[rowOf(fret)] + fretY[rowOf(fret) + 1]) / 2;
  const dotR = Math.min(stringGap * 0.46, 9.5);
  const boardEdge = stringGap * 0.5;

  const ink = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const board = alpha(ink, theme.palette.mode === 'dark' ? 0.06 : 0.045);
  const fretLine = alpha(ink, 0.35);
  const inlay = alpha(ink, 0.13);
  const stringColor = alpha(ink, 0.7);
  const dot = theme.palette.chord.main;
  const dotText = theme.palette.chord.contrastText;

  // Marcações do braço (3ª, 5ª, 7ª, 9ª, 12ª dupla, 15ª)
  const inlayMarks: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const fret = baseFret + r;
    const y = (fretY[r] + fretY[r + 1]) / 2;
    if (INLAYS.includes(fret)) inlayMarks.push({ x: centerX, y });
    if (fret === DOUBLE_INLAY) {
      const off = stringGap * (n > 4 ? 2 : 1);
      inlayMarks.push({ x: centerX - off, y }, { x: centerX + off, y });
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role='img'
      aria-label={`Digitação: ${frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`}
      style={{ display: 'block', fontFamily: theme.typography.fontFamily }}
    >
      <style>{DOT_STYLE}</style>
      {/* escala (madeira do braço) */}
      <rect
        x={x(0) - boardEdge}
        y={TOP}
        width={gridW + boardEdge * 2}
        height={boardBottom - TOP}
        rx={3}
        fill={board}
      />

      {inlayMarks.map((m, i) => (
        <circle key={`i${i}`} cx={m.x} cy={m.y} r={Math.min(4, stringGap * 0.2)} fill={inlay} />
      ))}

      {/* trastes */}
      {fretY.map((y, r) => (r === 0 && baseFret === 1 ? null : (
        <line key={`f${r}`} x1={x(0) - boardEdge} x2={x(n - 1) + boardEdge} y1={y} y2={y} stroke={fretLine} strokeWidth={1.5} />
      )))}

      {/* pestana (nut) do instrumento, só na 1ª posição */}
      {baseFret === 1 && (
        <rect x={x(0) - boardEdge} y={TOP - 5} width={gridW + boardEdge * 2} height={6} rx={1.5} fill={alpha(ink, 0.85)} />
      )}

      {/* cordas: bordões mais grossos; cordas não tocadas ficam apagadas */}
      {frets.map((f, s) => (
        <line
          key={`s${s}`}
          x1={x(s)} x2={x(s)} y1={TOP} y2={boardBottom}
          stroke={stringColor}
          strokeWidth={stringGauges[s] ?? 1}
          opacity={f < 0 ? 0.35 : 1}
        />
      ))}

      {/* ○ solta / × não tocar */}
      {frets.map((f, s) => {
        if (f > 0) return null;
        const cy = TOP - 14;
        return f === 0 ? (
          <circle key={`m${s}`} cx={x(s)} cy={cy} r={4} fill='none' stroke={ink} strokeWidth={1.4} />
        ) : (
          <g key={`m${s}`} stroke={muted} strokeWidth={1.4} strokeLinecap='round'>
            <line x1={x(s) - 3.5} y1={cy - 3.5} x2={x(s) + 3.5} y2={cy + 3.5} />
            <line x1={x(s) - 3.5} y1={cy + 3.5} x2={x(s) + 3.5} y2={cy - 3.5} />
          </g>
        );
      })}

      {/* casa inicial */}
      {baseFret > 1 && (
        <text x={x(0) - boardEdge - 3} y={yDot(baseFret) + 4} textAnchor="end" fontSize={11} fill={ink}>
          {baseFret}ª
        </text>
      )}

      {/* pestana feita com o dedo */}
      {barre && (
        <rect
          key={`b${barre.fret}-${barre.fromString}-${barre.toString}`}
          className='chord-barre'
          x={x(barre.fromString) - dotR}
          y={yDot(barre.fret) - dotR}
          width={x(barre.toString) - x(barre.fromString) + dotR * 2}
          height={dotR * 2}
          rx={dotR}
          fill={dot}
        />
      )}

      {/* dedos */}
      {frets.map((f, s) => {
        if (f <= 0) return null;
        const inBarre = barre && f === barre.fret && s >= barre.fromString && s <= barre.toString;
        if (inBarre && s !== barre.fromString) return null;
        return (
          // A chave inclui a casa: ao trocar de digitação, só os dedos que mudaram "pulam" de novo.
          <g key={`d${s}-${f}`} className='chord-dot' style={{ animationDelay: `${DOT_DELAY_MS + s * DOT_STAGGER_MS}ms` }}>
            {!inBarre && <circle cx={x(s)} cy={yDot(f)} r={dotR} fill={dot} />}
            {fingers[s] > 0 && (
              <text x={x(s)} y={yDot(f) + 4} textAnchor='middle' fontSize={11} fontWeight={700} fill={dotText}>
                {fingers[s]}
              </text>
            )}
          </g>
        );
      })}

      {/* nome das cordas */}
      {instrument.stringNames.map((name, s) => (
        <text key={`n${s}`} x={x(s)} y={boardBottom + 16} textAnchor='middle' fontSize={10} fill={muted}>
          {name}
        </text>
      ))}
    </svg>
  );
}
