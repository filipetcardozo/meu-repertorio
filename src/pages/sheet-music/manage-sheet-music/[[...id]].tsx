import { useRouter } from 'next/router'
import { Layout } from "../../../components/app-layout"
import { ManageSheetMusicComponent } from '../../../components/sheet-music-manage'
import { useAuth, useProtectPage } from '../../../hooks/useAuth'
import Head from 'next/head'

const ManageSheetMusic = () => {
    const router = useRouter()
    const { id } = router.query
    const { isLogged } = useAuth()

    useProtectPage({redirectTo: "/auth/login"})

    if (isLogged != true) {
        return <Layout activeMenu={2}>
            <Head>
                <title>Alterar repertório - Meu Repertório</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            </Head>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={2}>
        <Head>
            <title>Alterar repertório - Meu Repertório</title>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        <ManageSheetMusicComponent sheetMusicId={id ? id[0] : undefined} />
    </Layout>
}

export default ManageSheetMusic;