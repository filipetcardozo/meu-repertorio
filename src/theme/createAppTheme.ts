import { alpha, createTheme, PaletteMode, ThemeOptions } from '@mui/material';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';

declare module '@mui/material/styles' {
  interface Palette {
    chord: Palette['primary'];
  }
  interface PaletteOptions {
    chord?: PaletteOptions['primary'];
  }
  interface Theme {
    brand: BrandTokens;
  }
  interface ThemeOptions {
    brand?: BrandTokens;
  }
}

type BrandTokens = {
  /** Gradiente da marca (fúcsia → violeta → índigo) para destaques: botão principal, logo, progresso. */
  gradient: string;
  /** Brilho suave usado no hover dos elementos com gradiente. */
  glow: string;
  /** "Luzes de palco" do fundo da página. */
  stageLights: string;
};

// Fonte de destaque para títulos e logo. O texto corrido continua na fonte padrão.
const display = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap' });
export const displayFontFamily = display.style.fontFamily;

// Fonte do texto corrido (listas, botões, menus).
const body = Inter({ subsets: ['latin'], display: 'swap' });
export const bodyFontFamily = body.style.fontFamily;

// Fonte das cifras: monoespaçada para o acorde ficar em cima da sílaba certa.
// Ligaduras desligadas: a JetBrains Mono junta sequências como "--" e "->", o que quebraria "----- Refrão -----".
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' });
export const monoFontFamily = mono.style.fontFamily;
export const monoFont = { fontFamily: monoFontFamily, fontVariantLigatures: 'none' } as const;

// Identidade visual: uma cor só (fúcsia) para a marca e para os acordes.
// Os tons mudam por modo para manter contraste AA no fundo claro e no escuro.
const brand = {
  light: { main: '#C026D3', light: '#D946EF', dark: '#A21CAF', contrastText: '#FFFFFF' },
  dark: { main: '#E879F9', light: '#F0ABFC', dark: '#C026D3', contrastText: '#0F1115' },
};

// Paradas do gradiente. Todas mantêm contraste AA com o contrastText do modo.
const gradientStops = {
  light: ['#C026D3', '#7C3AED', '#4F46E5'],
  dark: ['#E879F9', '#A78BFA', '#818CF8'],
};

// Acordes seguem a marca. Fica como token próprio para poder divergir no futuro.
const chord = brand;

const surfaces = {
  light: { default: '#fbfaff', paper: '#ffffff' },
  dark: { default: '#0b0b11', paper: '#15141d' },
};

export const createAppTheme = (mode: PaletteMode) => {
  const [g1, g2, g3] = gradientStops[mode];
  const isDark = mode === 'dark';
  const lightStrength = isDark ? 1 : 0.35;

  const brandTokens: BrandTokens = {
    gradient: `linear-gradient(120deg, ${g1} 0%, ${g2} 55%, ${g3} 100%)`,
    glow: `0 6px 20px ${alpha(g1, isDark ? 0.35 : 0.3)}`,
    stageLights: [
      `radial-gradient(640px 320px at 12% -8%, ${alpha(g1, 0.22 * lightStrength)}, transparent 70%)`,
      `radial-gradient(560px 300px at 92% -12%, ${alpha(g3, 0.2 * lightStrength)}, transparent 70%)`,
    ].join(', '),
  };

  const headings = Object.fromEntries(
    (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((h) => [h, { fontFamily: displayFontFamily, fontWeight: 600 }]),
  );

  const common: ThemeOptions = {
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: bodyFontFamily,
      ...headings,
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'pre, code, kbd, samp': monoFont,
          // Luzes de palco fixas atrás de todo o conteúdo (sem background-attachment, que trava no celular).
          'body::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            background: brandTokens.stageLights,
          },
        },
      },
      MuiTextField: { defaultProps: { variant: 'filled' } },
      MuiFormControl: { defaultProps: { variant: 'filled' } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 999,
            paddingInline: 16,
            variants: [
              {
                props: { variant: 'contained', color: 'primary' },
                style: {
                  backgroundImage: theme.brand.gradient,
                  transition: theme.transitions.create(['box-shadow', 'filter']),
                  '&:hover': { boxShadow: theme.brand.glow, filter: 'brightness(1.06)' },
                  '&.Mui-disabled': { backgroundImage: 'none' },
                },
              },
            ],
          }),
        },
      },
      MuiFab: {
        styleOverrides: {
          primary: ({ theme }) => ({
            backgroundImage: theme.brand.gradient,
            '&:hover': { boxShadow: theme.brand.glow },
            '&.Mui-disabled': { backgroundImage: 'none' },
          }),
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          // Barra translúcida e neutra: o fúcsia fica para os destaques.
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            backgroundImage: 'none',
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
            '@supports (backdrop-filter: blur(1px))': {
              backgroundColor: alpha(theme.palette.background.default, 0.72),
              backdropFilter: 'saturate(160%) blur(14px)',
            },
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          // O MUI clareia o Paper no escuro com um gradiente branco; tiramos para manter o palco escuro.
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({ borderRadius: 16, border: `1px solid ${theme.palette.divider}` }),
        },
      },
    },
  };

  return createTheme({
    ...common,
    brand: brandTokens,
    palette: {
      mode,
      primary: brand[mode],
      chord: chord[mode],
      background: surfaces[mode],
      ...(isDark && { divider: 'rgba(255, 255, 255, 0.08)' }),
    },
  });
};
