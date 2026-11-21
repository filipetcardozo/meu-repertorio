import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, Theme } from '@mui/material/styles';
import { displayFontFamily } from '../../theme/createAppTheme';

/**
 * Campo "outlined" do formulário de músicas: fundo levemente destacado,
 * borda discreta e anel de foco na cor da marca. Usar com variant='outlined'.
 */
export const fieldSx = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.025),
      transition: theme.transitions.create(['box-shadow', 'background-color']),
      '& fieldset': { borderColor: theme.palette.divider },
      '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.45) },
      '&.Mui-focused': {
        backgroundColor: 'transparent',
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.14)}`,
      },
      '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: 1 },
    },
    '& .MuiFormHelperText-root': { mx: 0.5 },
  };
};

/** Rótulo acima do campo (no lugar do label flutuante). */
export const Field = ({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.75, px: 0.25 }}>
      <Typography
        component='label'
        htmlFor={htmlFor}
        sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', letterSpacing: '0.01em' }}
      >
        {label}
      </Typography>
      {hint ? (
        <Typography component='span' sx={{ fontSize: 12, color: 'text.disabled' }} noWrap>
          {hint}
        </Typography>
      ) : null}
    </Box>
    {children}
  </Box>
);

/** Bloco do formulário com título e ação opcional à direita. */
export const Section = ({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Paper variant='outlined' sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
      {icon}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 17, lineHeight: 1.3 }} noWrap>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant='body2' sx={{ color: 'text.secondary' }} noWrap>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Box>
    {children}
  </Paper>
);

/** Ícone redondo com o gradiente da marca. */
export const BrandIcon = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={(theme) => ({
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: '10px',
      display: 'grid',
      placeItems: 'center',
      color: theme.palette.primary.contrastText,
      backgroundImage: theme.brand.gradient,
      '& svg': { fontSize: 20 },
    })}
  >
    {children}
  </Box>
);
