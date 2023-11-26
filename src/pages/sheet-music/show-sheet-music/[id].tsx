import { useRouter } from 'next/router'
import { Layout } from '../../../components/app-layout'
import { SheetMusicShow } from '../../../components/sheet-music-show'
import { SkeletonComponent } from '../../../components/sheet-music-show/Skeleton'
import { useAuth, useProtectPage } from '../../../hooks/useAuth'
import Head from 'next/head'
import React from 'react'

const ShowSheetMusic = () => {
  const router = useRouter()
  const { id } = router.query
  const { isLogged } = useAuth()

  useProtectPage({ redirectTo: "/auth/login" })

  if (isLogged != true) {
    return <Layout activeMenu={1}>
      <Head>
        <title>On The Show - Meu Repertório</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <SkeletonComponent />
    </ Layout>
  }

  return <Layout activeMenu={1}>
    <Head>
      <title>On The Show - Meu Repertório</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <SheetMusicShow sheetMusicId={id as string ?? ''} />
  </ Layout>
}

export default ShowSheetMusic;