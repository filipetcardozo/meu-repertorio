import React from 'react'

// Components
import { Layout } from '../../components/app-layout'
import Head from 'next/head'

// Authentication
import { useAuth } from '../../hooks/useAuth'
import { useProtectPage } from '../../hooks/useAuth'
import { HomeLyrics } from '../../components/home/HomeComponent'

// Algolia
import { InstantSearch, SearchBox, Hits, useHits } from 'react-instantsearch-hooks-web';
import { Configure } from 'react-instantsearch-hooks-web';
import algoliasearch from 'algoliasearch/lite';

const HomePage = () => {
    const searchClient = algoliasearch('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');
    const { isLogged } = useAuth()

    useProtectPage({ redirectTo: "/auth/login" })

    if (isLogged != true) {
        return <Layout activeMenu={0}>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={0}>
        <Head>
            <title>Home - Meu Repertório</title>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        <InstantSearch searchClient={searchClient} indexName="lyrics">
            <HomeLyrics />
        </InstantSearch>
    </ Layout>
}

export default HomePage;