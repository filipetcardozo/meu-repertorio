import React from "react";
import Head from 'next/head'

// Components
import { Layout } from "../../../components/app-layout";

// Hooks
import { useAuth, useProtectPage } from "../../../hooks/useAuth";
import { SheetsMusicsCards } from "../../../components/sheet-music-card/SheetsMusicsCards";
import { Box, CircularProgress } from "@mui/material";

const AllSheetMusic = () => {
  // States
  const { isLogged } = useAuth()

  useProtectPage({ redirectTo: "/auth/login" })

  if (isLogged != true) {
    return <Layout activeMenu={0}>
      <Head>
        <title>Repertórios cadastrados - Meu Repertório</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    </ Layout>
  }

  return <Layout activeMenu={1}>
    <Head>
      <title>Repertórios cadastrados - Meu Repertório</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <SheetsMusicsCards />
  </Layout>
}

export default AllSheetMusic;