import { getCompletedSheetMusicLocalSotrage, completedSheetMusicLocalStorageType } from "../../types/sheetMusicLocalSotrage";


export const getCompletedSheetMusicLocalStorage: getCompletedSheetMusicLocalSotrage = (sheetMusicId: string) => {
    let sheetMusic = localStorage.getItem(sheetMusicId)

    if (sheetMusic) {
        sheetMusic = JSON.parse(sheetMusic)
        return sheetMusic
    } else {
        return undefined
    }
}


export const putCompletedSheetMusicLocalStorage = (sheetMusicId: string, completedSteps: string) => {
    localStorage.setItem(sheetMusicId, completedSteps);
}