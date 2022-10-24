import React from "react";

// Components
import { Layout } from "../../../components/app-layout";

// Hooks
import { useAuth, useProtectPage } from "../../../hooks/useAuth";
import { SheetsMusicsCards } from "../../../components/sheet-music-card/SheetsMusicsCards";

const RegisteredSheetMusic = () => {
    // States
    const { isLogged } = useAuth()

    useProtectPage({ redirectTo: "/login" })

    if (isLogged != true) {
        return <Layout activeMenu={0}>
            Carregando...
        </ Layout>
    }

    return <Layout activeMenu={1}>
        <SheetsMusicsCards />
    </Layout>
}

export default RegisteredSheetMusic;