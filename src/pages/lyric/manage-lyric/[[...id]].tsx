import { useRouter } from "next/router";
import React from "react";
import Head from 'next/head'

// Components
import { Layout } from "../../../components/app-layout";
import { LyricManage } from "../../../components/lyric-manage";
import { useAuth, useProtectPage } from "../../../hooks/useAuth";

const ManageLyric = () => {
    const router = useRouter()
    const { id } = router.query
    const { isLogged } = useAuth()

    useProtectPage({ redirectTo: "/auth/login" })

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
        <LyricManage idLyric={id ? id[0] : undefined} />
    </Layout>
}

export default ManageLyric;