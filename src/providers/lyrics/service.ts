import { collection, getDocs, getDoc, addDoc, doc, limit, startAfter, orderBy, DocumentSnapshot } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { getApp } from "firebase/app";

import { query, where } from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { firebaseApp, database } from "../../../firebaseConfig";

// Get specific lyric
export async function getLyric(idLyric: string) {
    console.log("GET SPECIFIC LYRIC")

    let lyric: any = {}
    const docRef = doc(database, "lyrics", idLyric)
    const querySnapshot = await getDoc(docRef);
    lyric = { ...querySnapshot.data() }
    lyric.id = querySnapshot.id
    return lyric
}

// Get specific Sheet Music
export async function getSheetMusic(id: string) {
    console.log("GET SPECIFIC SHEETS MUSICS")

    let sheetMusic: any
    const docRef = doc(database, "sheetsMusics", id)
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
export async function getAllUserRegisteredLyrics() {
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
export async function getSpecificUserRegisteredLyrics(lyricId: any) {
    console.log("GET SPECIFIC REGISTERED LYRICS")

    const auth = getAuth();

    const queryRef = collection(database, "userLyricsRegistered");
    const q = query(queryRef, where("userId", "==", auth.currentUser?.uid), where("lyricId", "==", lyricId));
    const querySpecificLyricOfUser = await getDocs(q)
    if (querySpecificLyricOfUser.empty) return false;

    if (querySpecificLyricOfUser.docs.length > 1) return false;

    let newLyricRegistered = querySpecificLyricOfUser.docs[0].data()
    newLyricRegistered.id = querySpecificLyricOfUser.docs[0].id

    return newLyricRegistered;
}

// Get all Composers
export async function getAllComposers() {
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

// Get all musics
export async function getAllLyrics() {
    console.log("GET ALL LYRICS")

    let lyrics: any = []
    const querySnapshot = await getDocs(collection(database, "lyrics"));
    querySnapshot.forEach((doc) => {
        let lyric = doc.data()
        lyric.lyricId = doc.id
        lyrics.push(lyric)
    });
    return lyrics
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
export async function getAllSheetsMusics(uid: string) {
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