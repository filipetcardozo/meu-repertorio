import { collection, getDocs, getDoc, addDoc, doc, limit, startAfter, orderBy, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseApp, database } from "../../../firebaseConfig";
import { getLyricType, lyricType } from "../../types/lyricType";
import { getAllSheetsMusicsType, getSheetMusicType, sheetMusicType } from "../../types/sheetMusicType";
import { getAllRegisteredLyricsType, getRegisteredLyricType, registeredLyricType } from "../../types/registeredLyricType";
import { composerType, getAllComposersType, getComposerType } from "../../types/composerType";

// Types

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
    const querySnapshot = await getDoc(docRef);

    if (querySnapshot.exists()) {
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
    await updateDoc(docRef, {
        offset: newOffset
    })
        .then(() => {
            console.log('REGISTERED LYRIC OFFSET UPDATED')
        })
        .catch((error) => console.log('Error in update registereds lyrics: ' + error))
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
    await updateDoc(docRef, {
        composerName: newLyric.composerName,
        composerId: newLyric.composerId,
        lyric: newLyric.lyric,
        lyricName: newLyric.lyricName,
        originalTone: newLyric.originalTone
    })
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
        const docRef = await addDoc(collection(database, "lyrics"), lyricToAdd);
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
        const docRef = await addDoc(collection(database, "composers"), composerToAdd);
        console.log("COMPOSER written with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding COMPOSER: ", e);
        return false;
    }
}