import React from 'react';
import { Layout } from "../../../components/app-layout";
import { useAuth, useProtectPage } from "../../../hooks/useAuth";
import { LyricShowPage } from "../../../components/lyric-show/LyricShow";
import Head from 'next/head'
import { Box, CircularProgress } from '@mui/material';

const LyricShow = () => {
  const { isLogged } = useAuth()

  useProtectPage({ redirectTo: "/auth/login" })

  if (isLogged != true) {
    return <Layout activeMenu={2}>
      <Head>
        <title>Meu Repertório</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    </ Layout>
  }

  return <Layout>
    <Head>
      <title>Meu Repertório</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <LyricShowPage />
  </Layout>
}

export default LyricShow;