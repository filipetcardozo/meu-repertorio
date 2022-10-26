export type userInfosType = {
    uid: string;
    isAdmin: boolean;
}

export type getUserInfosType = (uid: string) => Promise<userInfosType | undefined>