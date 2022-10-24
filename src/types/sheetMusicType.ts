export type sheetMusicType = {
    description: string;
    lyrics: lyricInSheetMusicType[];
    sheetMusicName: string;
    userId: string;
    id?: string;
    completed?: number;
}

export type lyricInSheetMusicType = {
    composerId: string;
    composerName: string;
    lyricId: string;
    lyricName: string;
    lyricStyle: string;
    originalTone: string;
    id?: string;
}

export type getSheetMusicType = (idSheetMusic: string) => Promise<sheetMusicType>
export type getAllSheetsMusicsType = (uid: string) => Promise<sheetMusicType[]>