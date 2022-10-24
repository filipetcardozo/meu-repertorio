export type lyricType = {
    composerId: string;
    composerName: string;
    lyric: string;
    lyricName: string;
    lyricStyle: string;
    originalTone: string;
    id?: string;
}

export type getLyricType = (idLyric: string) => Promise<lyricType>