import { getUserInfosType, userInfosType } from "../../types/userInfos";
import { database } from "../../../firebaseConfig";
import { getDoc, doc, setDoc } from "firebase/firestore";
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

/** Grava as preferências de exibição da cifra no perfil (cria o documento do usuário se ainda não existir). */
export async function saveLyricDisplayPrefs(uid: string, prefs: LyricDisplayPrefs) {
    await setDoc(doc(database, "users", uid), { lyricDisplay: prefs }, { merge: true });
}
