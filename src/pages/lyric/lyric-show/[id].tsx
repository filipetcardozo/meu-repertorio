import React, { useEffect } from 'react';
import { Layout } from "../../../components/app-layout";
import { useAuth } from "../../../hooks/useAuth";
import { LyricShowPage } from "../../../components/lyric-show/LyricShow";
import Head from 'next/head'

const LyricShow = () => {
    const { isLogged } = useAuth()

    if (isLogged != true) {
        return <Layout activeMenu={2}>
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
        <LyricShowPage />
        {/* <LyricManage idLyric={id ? id[0] : undefined} /> */}
    </Layout>
}

export default LyricShow;