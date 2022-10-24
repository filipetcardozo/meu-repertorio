import {
    getLyric,
    getSheetMusic,
    getAllRegisteredLyrics,
    getRegisteredLyric,
    getAllComposers,
    getLyricsPaginate,
    getAllSheetsMusics
} from "./services";

export const getLyricsServices = () => {
    return {
        getLyric,
        getSheetMusic,
        getAllRegisteredLyrics,
        getRegisteredLyric,
        getAllComposers,
        getLyricsPaginate,
        getAllSheetsMusics
    }
} 