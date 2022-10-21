import { useRouter } from 'next/router'
import { Layout } from "../../../components/app-layout"
import { ManageSheetMusicComponent } from '../../../components/sheet-music-manage'
import { useAuth } from '../../../hooks/useAuth'

const ManageSheetMusic = () => {
    const router = useRouter()
    const { id } = router.query
    const { isLogged } = useAuth()

    if (isLogged != true) {
        return <Layout activeMenu={2}>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={2}>
        <ManageSheetMusicComponent sheetMusicId={id ? id[0] : undefined} />
    </Layout>
}

export default ManageSheetMusic;