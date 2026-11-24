import { getUserInfosType, userInfosType } from "../../types/userInfos";
import { database } from "../../../firebaseConfig";
import { getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { LyricDisplayPrefs } from "../../utils/lyricDisplayPrefs";

export const getUserInfos: getUserInfosType = async (uid) => {
    let user: any = {}
    const docRef = doc(database, "users", uid)
    const querySnapshot = await getDoc(docRef);

    if (querySnapshot.exists()) {
        user = { ...querySnapshot.data() }
        user.id = querySnapshot.id
        return user as userInfosType
    } else {
        return undefined;
    }
}

/**
 * Cria o perfil do usuário (users/{uid}) no primeiro acesso.
 * `isAdmin` nunca é gravado pelo app: as regras do Firestore recusam.
 */
export async function createUserProfile(user: User): Promise<userInfosType> {
    const profile = {
        uid: user.uid,
        name: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        provider: user.providerData[0]?.providerId ?? 'password',
        createdAt: serverTimestamp(),
    }
    await setDoc(doc(database, "users", user.uid), profile, { merge: true });
    return { ...profile, isAdmin: false }
}

/** Grava as preferências de exibição da cifra no perfil (cria o documento do usuário se ainda não existir). */
export async function saveLyricDisplayPrefs(uid: string, prefs: LyricDisplayPrefs) {
    await setDoc(doc(database, "users", uid), { lyricDisplay: prefs }, { merge: true });
}
