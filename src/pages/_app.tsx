import type { AppProps } from 'next/app';
import React from 'react';
import Head from 'next/head';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeModeProvider } from '../theme/ThemeModeProvider';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <title>Toca Mais Uma</title>
        <link rel='icon' href='/logo.svg' type='image/svg+xml' />
        <link rel='icon' href='/favicon.ico' sizes='16x16 32x32 48x48' />
        <link rel='apple-touch-icon' href='/apple-touch-icon.png' />
        <meta name='application-name' content='Toca Mais Uma' />
        <meta name='apple-mobile-web-app-title' content='Toca Mais Uma' />
      </Head>
      <ThemeModeProvider>
        <SnackbarProvider maxSnack={3}>
          <Component {...pageProps} />
        </SnackbarProvider>
      </ThemeModeProvider>
    </AuthProvider>
  );
}

export default MyApp;
