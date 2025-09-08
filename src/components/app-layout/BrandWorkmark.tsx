import * as React from 'react';
import Link from 'next/link';
import { Box, Typography, IconButton } from '@mui/material';
import { useTheme, lighten, darken } from '@mui/material/styles';

type Props = {
  compact?: boolean;
  href?: string;
  onClickIcon?: () => void;
};

export const BrandWordmark: React.FC<Props> = ({ compact = false, href = '/', onClickIcon }) => {
  const theme = useTheme();

  const start = theme.palette.primary.main;
  const end =
    theme.palette.mode === 'dark'
      ? lighten(theme.palette.primary.light, 0.2)
      : darken(theme.palette.primary.main, 0.2);

  return (
    <Box
      component={Link}
      href={href}
      aria-label='Meu Repertório - início'
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
      }}
    >
      <Typography
        variant='h6'
        sx={{
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1,
          backgroundImage: `linear-gradient(90deg, ${start}, ${end})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'primary.main',
          display: 'inline-block',
        }}
      >
        {compact ? 'MR' : 'Meu Repertório'}
      </Typography>
    </Box>
  );
};
