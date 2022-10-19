import {
    getLyric,
    getSheetMusic,
    getAllUserRegisteredLyrics,
    getSpecificUserRegisteredLyrics,
    getAllComposers,
    getAllLyrics,
    getLyricsPaginate,
    getAllSheetsMusics
} from "./service";

export const getLyricsServices = () => {
    return {
        getLyric,
        getSheetMusic,
        getAllUserRegisteredLyrics,
        getSpecificUserRegisteredLyrics,
        getAllComposers,
        getAllLyrics,
        getLyricsPaginate,
        getAllSheetsMusics
    }
} 