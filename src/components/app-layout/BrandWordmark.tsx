import * as React from 'react';
import Link from 'next/link';
import { Box, Typography } from '@mui/material';
import { displayFontFamily } from '../../theme/createAppTheme';
import { BrandLogo } from './BrandLogo';

type Props = {
  compact?: boolean;
  href?: string;
  onClickIcon?: () => void;
};

/** Nome da marca: "toca mais uma!", com o "uma!" no gradiente e meio torto, como quem grita do fundo do bar. */
export const BrandName: React.FC<{ fontSize?: number }> = ({ fontSize = 20 }) => (
  <Typography
    component='span'
    sx={{
      fontFamily: displayFontFamily,
      fontWeight: 700,
      fontSize,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      color: 'text.primary',
    }}
  >
    toca mais{' '}
    <Box
      component='span'
      sx={(theme) => ({
        display: 'inline-block',
        transform: 'rotate(-6deg) translateY(-1px)',
        backgroundImage: theme.brand.gradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        // Folga para o "!" não ser cortado pelo recorte do gradiente.
        pr: '0.06em',
      })}
    >
      uma!
    </Box>
  </Typography>
);

export const BrandWordmark: React.FC<Props> = ({ compact = false, href = '/' }) => (
  <Box
    component={Link}
    href={href}
    aria-label='Toca Mais Uma - início'
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      textDecoration: 'none',
      color: 'inherit',
      minWidth: 0,
    }}
  >
    <BrandLogo size={compact ? 30 : 34} />
    {!compact && <BrandName />}
  </Box>
);
