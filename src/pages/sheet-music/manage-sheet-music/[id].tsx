import { useRouter } from 'next/router'
import { Layout } from "../../../components/app-layout"
import { ManageSheetMusicComponent } from '../../../components/sheet-music-manage'

const ManageSheetMusic = () => {
    const router = useRouter()
    const { id } = router.query

    return <Layout activeMenu={2}>
        <ManageSheetMusicComponent sheetMusicId={id} />
    </Layout>
}

export default ManageSheetMusic;