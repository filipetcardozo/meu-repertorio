export const useStorageSheetMusic = () => {
    function callGetCompletedSheetMusicLocalStorage(sheetMusicId: string) {
        let sheetMusic = localStorage.getItem(sheetMusicId)

        if (sheetMusic) {
            sheetMusic = JSON.parse(sheetMusic)
            return sheetMusic
        } else {
            return undefined
        }
    }

    function callPutCompletedSheetMusicLocalStorage(sheetMusicId: string, completedSteps: boolean[]) {
        let newCompletedSteps = JSON.stringify(completedSteps)
        localStorage.setItem(sheetMusicId, newCompletedSteps);
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