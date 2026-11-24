import { Timestamp } from "firebase/firestore";

export type sheetMusicType = {
    description: string;
    lyrics: lyricInSheetMusicType[];
    sheetMusicName: string;
    userId: string;
    id?: string;
    lastUpdated?: Timestamp;
    completed?: number;
}

export type lyricInSheetMusicType = {
    composerId: string;
    composerName: string;
    lyricId: string;
    lyricName: string;
    lyricStyle: string;
    originalTone: string;
    composerImage?: string;
    compactView?: boolean;
    offset?: number;
    stars?: number;
    id?: string;
}

/** `false` quando não existe ou não é do usuário logado. */
export type getSheetMusicType = (idSheetMusic: string) => Promise<sheetMusicType | false>
export type getAllSheetsMusicsType = (uid: string) => Promise<sheetMusicType[]>