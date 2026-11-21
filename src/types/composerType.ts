export type composerType = {
    composerName: string;
    mainMusicStyle: string;
    id?: string;
    /** Foto do artista (URL) */
    image?: string;
    /** Slug do artista no Cifra Club (ex.: "legiao-urbana") */
    cifraClubSlug?: string;
}

export type getComposerType = (idComposer: string) => Promise<composerType>
export type getAllComposersType = () => Promise<composerType[]>