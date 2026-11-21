import React from "react";
import Head from 'next/head'
import { Layout } from "../../../components/app-layout";
import { useAuth, useProtectPage } from "../../../hooks/useAuth";
import { SheetsMusicsCards } from "../../../components/sheet-music-cards";
import { Box, CircularProgress, Container } from "@mui/material";

const AllSheetMusic = () => {
  const { isLogged } = useAuth()

  useProtectPage({ redirectTo: "/auth/login" })

  if (isLogged != true) {
    return <Layout activeMenu={0}>
      <Head>
        <title>Repertórios cadastrados - Meu Repertório</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    </ Layout>
  }

  return <Layout activeMenu={1}>
    <Head>
      <title>Repertórios cadastrados - Meu Repertório</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <Container sx={{ pt: { xs: 2, sm: 3 }, pb: 3, px: { xs: 1.5, sm: 3 } }}>
      <SheetsMusicsCards />
    </Container>
  </Layout>
}

export default AllSheetMusic;