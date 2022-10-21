import { useRouter } from "next/router";
import React from "react";

// Components
import { Layout } from "../../../components/app-layout";
import { LyricManage } from "../../../components/lyric-manage";
import { useAuth } from "../../../hooks/useAuth";

const ChangeLyric = () => {
    const router = useRouter()
    const { id } = router.query
    const { isLogged } = useAuth()

    if (isLogged != true) {
        return <Layout activeMenu={2}>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={4}>
        <LyricManage idLyric={id ? id[0] : undefined} />
    </Layout>
}

export default ChangeLyric;