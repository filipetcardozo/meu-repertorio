import { getCompletedSheetMusicLocalStorage, putCompletedSheetMusicLocalStorage } from "../providers/localStorage/sheetMusicCompleted"

export const useStorageSheetMusic = () => {
    function callGetCompletedSheetMusicLocalStorage(sheetMusicId: string) {
        let completedStorage = getCompletedSheetMusicLocalStorage(sheetMusicId)
        return completedStorage;
    }

    function callPutCompletedSheetMusicLocalStorage(sheetMusicId: string, completedSteps: boolean[]) {
        let newCompletedSteps = JSON.stringify(completedSteps)
        putCompletedSheetMusicLocalStorage(sheetMusicId, newCompletedSteps)
    }

    function callDeleteCompletedSheetMusicLocalStorage(sheetMusicId: string) {
        localStorage.removeItem(sheetMusicId);
    }

    return {
        callGetCompletedSheetMusicLocalStorage,
        callPutCompletedSheetMusicLocalStorage,
        callDeleteCompletedSheetMusicLocalStorage
    }
}