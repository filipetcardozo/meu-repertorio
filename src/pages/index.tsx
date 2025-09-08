import React from 'react'
import { Layout } from '../components/app-layout'
import Head from 'next/head'
import { useAuth } from '../hooks/useAuth'
import { useProtectPage } from '../hooks/useAuth'
import { HomeLyrics } from '../components/home/HomeComponent'
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch } from 'react-instantsearch-hooks-web';
import { Box, CircularProgress, Container } from '@mui/material'

const HomePage = () => {
  const searchClient = algoliasearch('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');
  const { isLogged } = useAuth()

  useProtectPage({ redirectTo: "/auth/login" })

  if (isLogged != true) {
    return <Layout activeMenu={0}>
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    </ Layout>
  }

  return <Layout activeMenu={0}>
    <Head>
      <title>Home - Meu Repertório</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <InstantSearch searchClient={searchClient} indexName="lyrics">
      <Container sx={{ pt: 1}}>
        <HomeLyrics />
      </Container>
    </InstantSearch>
  </ Layout>
}

export default HomePage;