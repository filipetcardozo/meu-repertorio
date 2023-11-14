import type { AppProps } from 'next/app'
import React from 'react'
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../hooks/useAuth';
import { createTheme, ThemeProvider } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#003366',
      light: '#0066CC'
    },
    secondary: {
      main: '#006699',
      light: '#004C99'
    },
    text: {
      primary: '#003366',
      secondary: '#004C99'
    }
  },
  typography: {
    fontFamily: '-apple-system',
    fontSize: 13,
    h1: {
      fontSize: '2rem',
    },
    h2: {
      fontSize: '1.5rem',
    },
    h3: {
      fontSize: '1.25rem',
    },
    h4: {
      fontSize: '1rem',
    },
    h5: {
      fontSize: '0.875rem',
    },
    h6: {
      fontSize: '0.75rem',
    },
    button: {
      textTransform: 'none'
    }
  },
  components: {
    MuiTextField: {
      defaultProps: {
        variant: 'filled'
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
    },
    MuiFormControl: {
      defaultProps: {
        variant: 'filled'
      },
    },
  },
});

function MyApp({ Component, pageProps }: AppProps) {
  return <AuthProvider>
    <ThemeProvider theme={theme}>
      <SnackbarProvider maxSnack={3}>
        <Component {...pageProps} />
      </SnackbarProvider>
    </ThemeProvider>
  </AuthProvider>
}

export default MyApp
