import { createTheme, PaletteMode, ThemeOptions } from '@mui/material';

export const createAppTheme = (mode: PaletteMode) => {
  const common: ThemeOptions = {
    typography: {
      button: { textTransform: 'none' },
    },
    components: {
      MuiTextField: { defaultProps: { variant: 'filled' } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiFormControl: { defaultProps: { variant: 'filled' } },
    },
  };

  return createTheme({
    ...common,
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
          background: { default: '#0f1115', paper: '#151922' },
        }
        : {
          background: { default: '#fafafa', paper: '#fff' },
        }),
    },
  });
};
