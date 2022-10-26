export type completedSheetMusicLocalStorageType = (boolean | undefined | null)[]

export type getCompletedSheetMusicLocalSotrage = (sheetMusicId: string) => completedSheetMusicLocalStorageType | undefined | string | null;