import React from 'react';
import { Layout } from '../components/app-layout';
import { useAuth, useProtectPage } from '../hooks/useAuth';
import Head from 'next/head'

const Custom500 = () => {
    const { isLogged } = useAuth()

    useProtectPage({redirectTo: "/auth/login"})

    if (isLogged != true) {
        return <Layout activeMenu={1}>
            <Head>
                <title>Meu Repertório</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            </Head>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={4}>
        <Head>
            <title>Meu Repertório</title>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        Ops... tivemos algum problema.
    </Layout>
}

export default Custom500;