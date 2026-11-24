import type { StoredDisplayPrefs } from "../utils/lyricDisplayPrefs";

export type userInfosType = {
    uid: string;
    /** Definido só pelo console do Firebase: o app não consegue gravar este campo. */
    isAdmin?: boolean;
    name?: string;
    email?: string;
    photoURL?: string;
    /** Tamanho da fonte e espaçamentos da cifra, por tipo de aparelho. */
    lyricDisplay?: StoredDisplayPrefs;
}

export type getUserInfosType = (uid: string) => Promise<userInfosType | undefined>
