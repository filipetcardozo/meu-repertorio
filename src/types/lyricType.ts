export type lyricType = {
    composerId: string;
    composerName: string;
    lyric: string;
    lyricName: string;
    lyricStyle: string;
    originalTone: string;
    id?: string;

    // Metadados opcionais (preenchidos ao importar do Cifra Club)
    composerImage?: string;
    coverImage?: string;
    songwriters?: string[];
    capo?: number;
    tuning?: string;
    bpm?: number;
    beatsPerBar?: number;
    strummings?: lyricStrummingType[];
    youtubeId?: string;
    sourceUrl?: string;
    /** Modo compacto no show (resume repetições) */
    compactView?: boolean;
}

export type lyricStrummingType = {
    section: string;
    bpm: number | null;
    timeSignature: string[];
    pattern: number[];
}

export type getLyricType = (idLyric: string) => Promise<lyricType>