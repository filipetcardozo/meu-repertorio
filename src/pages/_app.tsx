import type { AppProps } from 'next/app'
import React from 'react'
import { SnackbarProvider } from 'notistack';

// Firebase
import { firebaseApp } from '../../firebaseConfig';
import { AuthProvider } from '../hooks/useAuth';

function MyApp({ Component, pageProps }: AppProps) {
  return <AuthProvider>
    <SnackbarProvider maxSnack={3}>
      <Component {...pageProps} />
    </SnackbarProvider>

  </AuthProvider>
}

export default MyApp
