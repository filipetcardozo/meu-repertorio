import * as React from 'react';
import Link from 'next/link';
import { Box, Typography, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';

type Props = {
  compact?: boolean;
  href?: string;
  onClickIcon?: () => void;
};

export const BrandWordmark: React.FC<Props> = ({ compact = false, href = '/', onClickIcon }) => {
  const theme = useTheme();

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
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          backgroundImage: theme.brand.gradient,
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
