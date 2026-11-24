import React, { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { displayFontFamily } from '../../theme/createAppTheme';
import { fieldSx } from '../lyric-manage/formUi';
import { Copyright } from './Copyright';
import { BrandLogo } from '../app-layout/BrandLogo';
import { BrandName } from '../app-layout/BrandWordmark';

/** Campo de texto das telas de autenticação: mesmo visual dos formulários do app. */
export const authFieldSx = fieldSx;

/** Moldura das telas de login, cadastro e recuperação de senha. */
export const AuthShell = ({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => (
  <Box
    component='main'
    sx={(theme) => ({
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
      py: 4,
      backgroundImage: theme.brand.stageLights,
    })}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 3 }}>
      <BrandLogo size={48} title='Toca Mais Uma' />
      <BrandName fontSize={26} />
    </Box>

    <Paper
      elevation={0}
      sx={(theme) => ({
        width: '100%',
        maxWidth: 420,
        p: { xs: 3, sm: 4 },
        borderRadius: '20px',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: `0 24px 60px ${alpha('#000', theme.palette.mode === 'dark' ? 0.45 : 0.08)}`,
      })}
    >
      <Typography component='h1' sx={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 24, lineHeight: 1.25 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant='body2' sx={{ color: 'text.secondary', mt: 0.75 }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ mt: 3 }}>{children}</Box>
    </Paper>

    {footer && (
      <Typography variant='body2' sx={{ mt: 3, color: 'text.secondary', '& a': { color: 'primary.main', fontWeight: 600 } }}>
        {footer}
      </Typography>
    )}
    <Box sx={{ mt: 4 }}>
      <Copyright />
    </Box>
  </Box>
);

/** Logo oficial "G" do Google (exigido pelas diretrizes de marca do Login do Google). */
const GoogleLogo = () => (
  <svg width='18' height='18' viewBox='0 0 48 48' aria-hidden='true'>
    <path fill='#EA4335' d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z' />
    <path fill='#4285F4' d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z' />
    <path fill='#FBBC05' d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z' />
    <path fill='#34A853' d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z' />
  </svg>
);

export const GoogleButton = ({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      fullWidth
      variant='outlined'
      size='large'
      startIcon={<GoogleLogo />}
      loading={loading}
      disabled={disabled}
      onClick={async () => {
        setLoading(true);
        try {
          await onClick();
        } finally {
          setLoading(false);
        }
      }}
      sx={(theme) => ({
        borderRadius: '12px',
        py: 1.25,
        textTransform: 'none',
        fontWeight: 600,
        color: 'text.primary',
        borderColor: theme.palette.divider,
        '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5), backgroundColor: alpha(theme.palette.primary.main, 0.04) },
      })}
    >
      {label}
    </Button>
  );
};

export const OrDivider = () => (
  <Divider sx={{ my: 2.5, color: 'text.secondary', fontSize: 13 }}>ou com e-mail</Divider>
);

/** Botão principal (gradiente da marca). */
export const SubmitButton = ({ children, loading }: { children: React.ReactNode; loading?: boolean }) => (
  <Button
    type='submit'
    fullWidth
    size='large'
    variant='contained'
    loading={loading}
    sx={(theme) => ({
      mt: 1,
      borderRadius: '12px',
      py: 1.25,
      textTransform: 'none',
      fontWeight: 600,
      backgroundImage: theme.brand.gradient,
      color: theme.palette.primary.contrastText,
      boxShadow: 'none',
      '&:hover': { boxShadow: theme.brand.glow },
    })}
  >
    {children}
  </Button>
);

export const AuthLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href}>{children}</Link>;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
