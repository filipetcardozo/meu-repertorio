import { alpha, Theme } from '@mui/material/styles';
import { displayFontFamily } from '../../theme/createAppTheme';

/**
 * Estilo dos títulos de seção (`<em class="section-title">`, ver utils/sectionTitles) e das marcas
 * do modo compacto (`<i class="repeat">`). Rótulo centralizado, em índigo (os acordes são fúcsia),
 * com linha tracejada dos dois lados. Usar dentro do `sx` do container da cifra.
 */
export const chordSheetMarksSx = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark';
  const accent = isDark ? '#A5B4FC' : '#4F46E5';
  return {
    '& em.section-title': {
      fontStyle: 'normal',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.6em',
      width: '100%',
      boxSizing: 'border-box',
      verticalAlign: 'middle',
      margin: '0.35em 0 0.15em',
      fontFamily: displayFontFamily,
      fontSize: '0.78em',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: accent,
      whiteSpace: 'nowrap',
      '&::before, &::after': {
        content: '""',
        flex: 1,
        minWidth: '1.5em',
        borderTop: `1.5px dashed ${alpha(accent, 0.45)}`,
      },
    },
    '& i.repeat': {
      fontStyle: 'normal',
      fontWeight: 600,
      color: 'text.secondary',
    },
    '& em.section-title i.repeat': {
      fontFamily: displayFontFamily,
      fontSize: '0.92em',
      fontWeight: 700,
      letterSpacing: '0.02em',
      textTransform: 'none',
      color: accent,
      padding: '0.1em 0.6em',
      borderRadius: 999,
      backgroundColor: alpha(accent, isDark ? 0.16 : 0.1),
    },
  } as const;
};
