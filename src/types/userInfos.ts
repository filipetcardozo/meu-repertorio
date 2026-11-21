import type { StoredDisplayPrefs } from "../utils/lyricDisplayPrefs";

export type userInfosType = {
    uid: string;
    isAdmin: boolean;
    /** Tamanho da fonte e espaçamentos da cifra, por tipo de aparelho. */
    lyricDisplay?: StoredDisplayPrefs;
}

export type getUserInfosType = (uid: string) => Promise<userInfosType | undefined>