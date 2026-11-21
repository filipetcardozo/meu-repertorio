import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ação à direita do título (ex.: botão "Novo repertório"). */
  action?: React.ReactNode;
};

export const getGreeting = (date = new Date()) => {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/** Cabeçalho de página com título na fonte de destaque. */
export const PageHero = ({ title, subtitle, action }: Props) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: { xs: 'flex-start', sm: 'flex-end' },
      flexDirection: { xs: 'column', sm: 'row' },
      gap: 2,
      mb: { xs: 2.5, sm: 3 },
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography component='h1' variant='h4' sx={{ fontSize: { xs: 26, sm: 32 }, letterSpacing: '-0.02em' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{subtitle}</Typography>
      )}
    </Box>
    {action}
  </Box>
);
