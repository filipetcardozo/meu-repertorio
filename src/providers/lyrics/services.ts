import { collection, getDocs, getDoc, addDoc, doc, limit, startAfter, orderBy, updateDoc, deleteDoc, deleteField, serverTimestamp, writeBatch } from "firebase/firestore";
import { query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseApp, database } from "../../../firebaseConfig";
import { getLyricType, lyricType } from "../../types/lyricType";
import { getAllSheetsMusicsType, getSheetMusicType, sheetMusicType } from "../../types/sheetMusicType";
import { getAllRegisteredLyricsType, getRegisteredLyricType, registeredLyricType } from "../../types/registeredLyricType";
import { composerType, getAllComposersType, getComposerType } from "../../types/composerType";

// Types

/** O Firestore recusa campos `undefined`: remove antes de gravar. */
function withoutUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

const LYRIC_META_FIELDS = [
    'composerImage', 'coverImage', 'songwriters', 'capo', 'tuning', 'bpm',
    'beatsPerBar', 'strummings', 'youtubeId', 'sourceUrl',
] as const

// Get specific lyric
export const getLyric: getLyricType = async (idLyric) => {
    console.log("GET SPECIFIC LYRIC")

    let lyric: any = {}
    const docRef = doc(database, "lyrics", idLyric)
    const querySnapshot = await getDoc(docRef);

    if (querySnapshot.exists()) {
        lyric = { ...querySnapshot.data() }
        lyric.id = querySnapshot.id
        return lyric
    } else {
        return undefined;
    }

}

// Get specific Sheet Music
export const getSheetMusic: getSheetMusicType = async (idSheetMusic) => {
    console.log("GET SPECIFIC SHEETS MUSICS")

    let sheetMusic: any
    const docRef = doc(database, "sheetsMusics", idSheetMusic)
    // Repertório é privado: de outro usuário, as regras recusam (permission-denied) e conta como inexistente.
    const querySnapshot = await getDoc(docRef).catch(() => null);

    if (querySnapshot?.exists() && querySnapshot.data().userId === getAuth().currentUser?.uid) {
        sheetMusic = { ...querySnapshot.data() }
        sheetMusic.id = querySnapshot.id

        return sheetMusic
    } else {
        return false
    }
}

// Get specific user registereds lyrics
export const getAllRegisteredLyrics: getAllRegisteredLyricsType = async () => {
    console.log("GET REGISTERED LYRICS")

    const auth = getAuth();

    const queryRef = collection(database, "userLyricsRegistered");
    const q = query(queryRef, where("userId", "==", auth.currentUser?.uid));
    const queryAllLyrics = await getDocs(q)
    if (queryAllLyrics.empty) return false;

    const allLyrics: any = []
    queryAllLyrics.forEach(value => {
        let newLyricToAll = value.data()
        newLyricToAll.id = value.id
        allLyrics.push(newLyricToAll)
    })
    return allLyrics;
}

// Get specific user registered lyric
export const getRegisteredLyric: getRegisteredLyricType = async (uid, lyricId) => {
    console.log("GET SPECIFIC REGISTERED LYRICS")

    const queryRef = collection(database, "userLyricsRegistered");
    const q = query(queryRef, where("userId", "==", uid), where("lyricId", "==", lyricId));
    const querySpecificLyricOfUser = await getDocs(q)

    if (!querySpecificLyricOfUser.empty) {
        let newLyricRegistered = querySpecificLyricOfUser.docs[0].data()
        newLyricRegistered.id = querySpecificLyricOfUser.docs[0].id

        return newLyricRegistered as registeredLyricType;
    } else {
        return undefined;
    }
}

// Get all Composers
export const getAllComposers: getAllComposersType = async () => {

    console.log("GET ALL COMPOSERS")

    let composers: any = []
    const querySnapshot = await getDocs(collection(database, "composers"));
    querySnapshot.forEach((doc) => {
        let composer = doc.data()
        composer.id = doc.id
        composers.push(composer)
    });
    return composers
}

// Get all musics paginates
export async function getLyricsPaginate(startsInValue?: any) {
    console.log("GET LYRICS PAGINATE")
    console.log(startsInValue)

    let lyrics: any = []
    // const querySnapshot = await getDocs(collection(db, "lyrics"));

    const queryRef = collection(database, "lyrics");
    let q = query(queryRef, orderBy("lyricName"), limit(8));

    console.log(startsInValue)
    if (startsInValue) {
        q = query(queryRef, orderBy("lyricName"),
            startAfter(startsInValue), limit(8));
    }


    const queryLyricsPaginate = await getDocs(q)
    if (queryLyricsPaginate.empty) return false;

    return queryLyricsPaginate

    // Setting an id for lyrics
    queryLyricsPaginate.forEach((doc) => {
        let lyric = doc.data()
        lyric.lyricId = doc.id
        lyrics.push(lyric)
    });
}

// Get all sheets musics
export const getAllSheetsMusics: getAllSheetsMusicsType = async (uid) => {
    console.log("GET ALL SHEETS MUSICS")

    // const auth = getAuth();

    const queryRef = collection(database, "sheetsMusics");
    const q = query(queryRef, where("userId", "==", uid));
    const querySnapshot = await getDocs(q)

    let sheetsMusics: any = []
    querySnapshot.forEach((doc) => {
        let sheetMusic = doc.data()
        sheetMusic.id = doc.id
        sheetsMusics.push(sheetMusic)
    })
    return sheetsMusics
}

export async function updateUserRegisteredLyricOffset(registeredId: any, newOffset: any) {
    const docRef = doc(database, "userLyricsRegistered", registeredId);
    // Sem catch aqui: quem chama precisa saber se falhou (para não mostrar "salvo")
    await updateDoc(docRef, {
        offset: newOffset
    })
}

export async function updateUserRegisteredLyricStars(registeredId: any, newStars: any) {
    const docRef = doc(database, "userLyricsRegistered", registeredId);
    await updateDoc(docRef, {
        stars: newStars
    })
        .then(() => {
            console.log('REGISTERED LYRIC STARS UPDATED')
        })
        .catch((error) => console.log('Error in update registereds lyrics stars: ' + error))
}

// Put a Sheet Music
export async function putSheetMusic(sheetMusic: sheetMusicType) {
    try {
        const docRef = await addDoc(collection(database, "sheetsMusics"), sheetMusic);
        console.log("SHEET MUSIC written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding SHEET MUSIC: ", e);
        return false;
    }
}

// Put a Registered Lyric
export async function putUserLyricRegistered(lyricToRegister: registeredLyricType) {
    try {
        const docRef = await addDoc(collection(database, "userLyricsRegistered"), lyricToRegister);
        console.log("USER REGISTERED LYRIC written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding USER REGISTERED LYRIC: ", e);
        throw new Error('Error adding USER REGISTERED LYRIC')
    }
}


// Update specific Sheet Music
export async function updateUserSheetMusic(sheetMusicId: any, newSheetMusic: any) {
    const docRef = doc(database, "sheetsMusics", sheetMusicId);
    await updateDoc(docRef, {
        description: newSheetMusic.description,
        sheetMusicName: newSheetMusic.sheetMusicName,
        lyrics: newSheetMusic.lyrics,
        lastUpdated: serverTimestamp()
    })
        .then(() => {
            console.log('SUCCESSFULLY UPDATED SHEET MUSIC')
            return true;
        })
        .catch((error) => {
            console.log('Error in update SHEET MUSIC: ' + error)
            return false;
        })
}

// Update specific Lyric
export async function updateLyric(lyricId: any, newLyric: lyricType) {
    const docRef = doc(database, "lyrics", lyricId);
    // Metadado apagado no formulário (undefined) é removido do documento
    const meta = Object.fromEntries(LYRIC_META_FIELDS.map((k) => [k, newLyric[k] === undefined ? deleteField() : newLyric[k]]))
    await updateDoc(docRef, withoutUndefined({
        composerName: newLyric.composerName,
        composerId: newLyric.composerId,
        lyric: newLyric.lyric,
        lyricName: newLyric.lyricName,
        originalTone: newLyric.originalTone,
        lyricStyle: newLyric.lyricStyle,
        ...meta,
    }))
        .then(() => {
            console.log('SUCCESSFULLY UPDATED LYRIC')
            return true;
        })
        .catch((error) => {
            console.log('Error in update Lyric: ' + error)
            return false;
        })
}

// Put a lyric
export async function deleteSheetMusic(sheetMusicId: string) {
    try {
        const docRef = doc(database, "sheetsMusics", sheetMusicId)
        await deleteDoc(docRef)
            .then((value: any) => {
                console.log('Sheet Music Deleted')
                console.log(value)
            })
            .catch((error) => console.log('Error in update registereds lyrics stars: ' + error))

        return true;
    } catch (e) {
        console.error("Error deleting sheet music: ", e);
        return false;
    }
}

// Put a lyric
export async function putLyric(lyricToAdd: lyricType) {
    try {
        const { id: _id, ...data } = lyricToAdd
        const docRef = await addDoc(collection(database, "lyrics"), withoutUndefined(data));
        console.log("LYRIC written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding LYRIC: ", e);
        return false;
    }
}

// Put a Composer
export async function putComposer(composerToAdd: composerType) {
    try {
        const { id: _id, ...data } = composerToAdd
        const docRef = await addDoc(collection(database, "composers"), withoutUndefined(data));
        console.log("COMPOSER written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding COMPOSER: ", e);
        return false;
    }
}

// Update a Composer (ex.: completar foto/slug vindos do Cifra Club)
export async function updateComposer(composerId: string, data: Partial<composerType>) {
    try {
        const { id: _id, ...rest } = data
        await updateDoc(doc(database, "composers", composerId), withoutUndefined(rest))
        return true
    } catch (e) {
        console.error("Error updating COMPOSER: ", e)
        return false
    }
}

/**
 * Atualiza o artista e replica nome/foto em todas as músicas dele
 * (as músicas guardam uma cópia desses campos para as listas e a busca).
 */
export async function updateComposerEverywhere(composerId: string, data: Partial<composerType>) {
    const ok = await updateComposer(composerId, data)
    if (!ok) return false

    const lyricPatch = withoutUndefined({ composerName: data.composerName, composerImage: data.image })
    if (!Object.keys(lyricPatch).length) return true

    try {
        // As regras só permitem listar músicas de 20 em 20: vai página por página
        const PAGE = 20
        let last: any = null
        for (;;) {
            const base = query(collection(database, "lyrics"), where("composerId", "==", composerId), limit(PAGE))
            const snap = await getDocs(last ? query(base, startAfter(last)) : base)
            if (snap.empty) break
            const batch = writeBatch(database)
            snap.docs.forEach((d) => batch.update(d.ref, lyricPatch))
            await batch.commit()
            if (snap.docs.length < PAGE) break
            last = snap.docs[snap.docs.length - 1]
        }
    } catch (e) {
        console.error("Error updating composer's LYRICS: ", e)
    }
    return true
}

// Músicas já cadastradas com o mesmo nome (para avisar duplicidade antes de importar)
export async function findLyricsByName(lyricName: string): Promise<lyricType[]> {
    const name = lyricName.trim()
    if (!name) return []
    const snap = await getDocs(query(collection(database, "lyrics"), where("lyricName", "==", name), limit(20)))
    return snap.docs.map((d) => ({ ...(d.data() as lyricType), id: d.id }))
}

// Liga/desliga o modo compacto (resumo das repetições) de uma música
export async function setLyricCompactView(lyricId: string, compactView: boolean) {
    try {
        await updateDoc(doc(database, "lyrics", lyricId), { compactView })
        return true
    } catch (e) {
        console.error("Error updating LYRIC compactView: ", e)
        return false
    }
}
