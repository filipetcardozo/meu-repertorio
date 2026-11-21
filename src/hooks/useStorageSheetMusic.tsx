type activeLyricStorageType = { index: number, lyricId?: string }

const activeLyricKey = (sheetMusicId: string) => `${sheetMusicId}:activeLyric`

export const useStorageSheetMusic = () => {
    function callGetCompletedSheetMusicLocalStorage(sheetMusicId: string) {
        let sheetMusic = localStorage.getItem(sheetMusicId)

        if (sheetMusic) {
            let newSheetMusic = JSON.parse(sheetMusic) as boolean[]
            return newSheetMusic
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
        callDeleteActiveLyricSheetMusicLocalStorage(sheetMusicId)
    }

    // Música atual do repertório, para continuar nela após recarregar a página
    function callGetActiveLyricSheetMusicLocalStorage(sheetMusicId: string): activeLyricStorageType | undefined {
        try {
            const stored = localStorage.getItem(activeLyricKey(sheetMusicId))
            if (!stored) return undefined
            const parsed = JSON.parse(stored)
            if (typeof parsed?.index !== 'number') return undefined
            return parsed as activeLyricStorageType
        } catch {
            return undefined
        }
    }

    function callPutActiveLyricSheetMusicLocalStorage(sheetMusicId: string, activeLyric: activeLyricStorageType) {
        try {
            localStorage.setItem(activeLyricKey(sheetMusicId), JSON.stringify(activeLyric))
        } catch {
            // localStorage indisponível (ex.: modo privado): apenas não persiste
        }
    }

    function callDeleteActiveLyricSheetMusicLocalStorage(sheetMusicId: string) {
        try {
            localStorage.removeItem(activeLyricKey(sheetMusicId))
        } catch { }
    }

    return {
        callGetCompletedSheetMusicLocalStorage,
        callPutCompletedSheetMusicLocalStorage,
        callDeleteCompletedSheetMusicLocalStorage,
        callGetActiveLyricSheetMusicLocalStorage,
        callPutActiveLyricSheetMusicLocalStorage,
        callDeleteActiveLyricSheetMusicLocalStorage
    }
}
