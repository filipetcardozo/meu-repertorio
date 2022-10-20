import { useRouter } from 'next/router'
import { Layout } from '../../../components/app-layout'
import { SheetMusicShow } from '../../../components/sheet-music-show'
import { SkeletonComponent } from '../../../components/sheet-music-show/Skeleton'
import { useAuth, useProtectPage } from '../../../hooks/useAuth'

const ShowSheetMusic = () => {
  const router = useRouter()
  const { id } = router.query

  const { isLogged } = useAuth()

  useProtectPage({ redirectTo: "/login" })

  if (isLogged != true) {
    return <Layout activeMenu={1}>
      <SkeletonComponent />
    </ Layout>
  }

  return <Layout activeMenu={1}>
    <SheetMusicShow sheetMusicId={id} />
  </ Layout>
}

export default ShowSheetMusic;