/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react"
import { getLyricsServices } from "../providers/lyrics"
import { useAuth } from "./useAuth"

export const useLyrics = () => {
    // Services
    const getLyrics = getLyricsServices()

    // States
    const [allUserRegisteredLyrics, setAllUserRegisteredLyrics] = useState<any[]>([])

    // Hooks
    const { user } = useAuth()

    useEffect(() => {
        if (user) {
            getLyrics.getAllUserRegisteredLyrics()
                .then((lyrics) => {
                    setAllUserRegisteredLyrics(lyrics)
                })
        }
    }, [user])


    return {
        allUserRegisteredLyrics
    }
}