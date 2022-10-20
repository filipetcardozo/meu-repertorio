/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from "react"
import { getLyricsServices } from "../providers/lyrics"
import { useAuth } from "./useAuth"
// import { useAuth } from "../user"

export const useSheetsMusics = () => {
    // Services
    const getLyrics = getLyricsServices()

    // States
    const [sheetsMusics, setSheetsMusics] = useState<any[]>([])

    // Hooks
    const { isLogged, uid } = useAuth()

    useEffect(() => {
        if (isLogged) {
            getLyrics.getAllSheetsMusics(uid!)
                .then((sheets) => {
                    setSheetsMusics(sheets)
                })
        }
    }, [])

    return {
        sheetsMusics
    }

}