/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from "react"
import { getLyricsServices } from "../providers/lyrics"
import { useAuth } from "./useAuth"
import { useStorageSheetMusic } from "./useStorageSheetMusic"
// import { useAuth } from "../user"

export const useSheetsMusics = () => {
    // Services
    const getLyrics = getLyricsServices()

    // States
    const [sheetsMusics, setSheetsMusics] = useState<any[]>([])

    // Hooks
    const { isLogged, uid } = useAuth()

    const { callGetCompletedSheetMusicLocalStorage } = useStorageSheetMusic()

    useEffect(() => {
        if (isLogged) {
            getLyrics.getAllSheetsMusics(uid!)
                .then((sheets) => {
                    sheets.map((v, index) => {
                        let completedValues: boolean[] = callGetCompletedSheetMusicLocalStorage(v.id!) as boolean[]
                        if (completedValues && completedValues.length > 0) {
                            let count = completedValues.filter((value: any) => value === true).length;
                            sheets[index].completed = count
                        }

                    })
                    callGetCompletedSheetMusicLocalStorage(sheets[0].id!)

                    setSheetsMusics(sheets)
                })
        }
    }, [])

    return {
        sheetsMusics
    }

}