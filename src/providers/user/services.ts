import { getUserInfosType, userInfosType } from "../../types/userInfos";
import { database } from "../../../firebaseConfig";
import { collection, getDocs, getDoc, addDoc, doc, limit, startAfter, orderBy, DocumentSnapshot, updateDoc, deleteDoc } from "firebase/firestore";

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