export type registeredLyricType = {
    composerId: string;
    composerName: string;
    lyricId: string;
    lyricName: string;
    lyricStyle: string;
    lyric?: string;
    offset: number;
    originalTone: string;
    stars: number;
    id?: string;
}

export type getRegisteredLyricType = (uid: string, lyricId: string | string[]) => Promise<registeredLyricType | undefined>
export type getAllRegisteredLyricsType = () => Promise<registeredLyricType[]>