import { getSpecificUserRegisteredLyrics } from "../providers/lyrics/service"
import { useAuth } from "./useAuth"

export const useLyricShowWithoutSheet = () => {
    const { uid } = useAuth()
    
    return {

    }
}