export type composerType = {
    composerName: string;
    mainMusicStyle: string;
    id?: string;
}

export type getComposerType = (idComposer: string) => Promise<composerType>
export type getAllComposersType = () => Promise<composerType[]>