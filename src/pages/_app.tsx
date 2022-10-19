// import '../styles/globals.css'
import type { AppProps } from 'next/app'
import React, { useEffect, useMemo } from 'react'
import { Provider } from 'react-redux'
import store from './store/store';

// Firebase
import { firebaseApp } from '../../firebaseConfig';
import { AuthProvider } from '../hooks/useAuth';

function MyApp({ Component, pageProps }: AppProps) {
  return <AuthProvider>
    <Component {...pageProps} />
  </AuthProvider>
}

export default MyApp
