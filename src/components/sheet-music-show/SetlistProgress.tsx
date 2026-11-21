import React from 'react';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

type Props = {
  /** Posição da música atual (base 0). */
  current: number;
  total: number;
  height?: number;
  /** Sem cantos arredondados no trilho (para quando a barra ocupa a largura toda, como divisor). */
  square?: boolean;
};

/** Barra de progresso do setlist, no gradiente da marca. */
export const SetlistProgress = ({ current, total, height = 3, square = false }: Props) => {
  const percent = total > 0 ? Math.min(100, ((current + 1) / total) * 100) : 0;
  return (
    <Box
      role='progressbar'
      aria-label='Progresso do repertório'
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-valuetext={`Música ${current + 1} de ${total}`}
      sx={(t) => ({
        height,
        width: '100%',
        borderRadius: square ? 0 : 999,
        overflow: 'hidden',
        // Mesmo tom do divisor do tema, para o trilho vazio parecer a linha divisória.
        backgroundColor: square ? t.palette.divider : alpha(t.palette.text.primary, 0.08),
      })}
    >
      <Box
        sx={(t) => ({
          height: '100%',
          width: `${percent}%`,
          borderRadius: square ? '0 999px 999px 0' : 999,
          backgroundImage: t.brand.gradient,
          transition: t.transitions.create('width', { duration: t.transitions.duration.standard }),
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        })}
      />
    </Box>
  );
};
