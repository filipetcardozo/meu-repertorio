import { useEffect } from "react"
import { useLyrics } from "../../../hooks/useLyrics"

export const HomeLyrics = () => {
    const { allUserRegisteredLyrics } = useLyrics()

    return <>
        Home Lyrics Component
    </>
}