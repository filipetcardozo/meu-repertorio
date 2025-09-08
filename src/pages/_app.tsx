import type { AppProps } from 'next/app';
import React from 'react';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeModeProvider } from '../theme/ThemeModeProvider';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <SnackbarProvider maxSnack={3}>
          <Component {...pageProps} />
        </SnackbarProvider>
      </ThemeModeProvider>
    </AuthProvider>
  );
}

export default MyApp;
