import type { AppProps } from 'next/app'
import React from 'react'
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../hooks/useAuth';
import { createTheme, ThemeProvider } from '@mui/material';

const theme = createTheme({
  typography: {
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
