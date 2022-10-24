import React, { useEffect } from 'react';
import { Layout } from "../../../components/app-layout";
import { useAuth } from "../../../hooks/useAuth";
import { LyricShowPage } from "../../../components/lyric-show/LyricShow";

const LyricShow = () => {
    const { isLogged } = useAuth()

    if (isLogged != true) {
        return <Layout activeMenu={2}>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={4}>
        <LyricShowPage />
        {/* <LyricManage idLyric={id ? id[0] : undefined} /> */}
    </Layout>
}

export default LyricShow;