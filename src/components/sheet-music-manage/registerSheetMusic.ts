import { getAuth } from "firebase/auth";
import { getRegisteredLyric, putSheetMusic, putUserLyricRegistered } from "../../providers/lyrics/services";

export async function registerSheetMusic(sheetMusicToAdd: any, setLoadingAddSheetMusic: any) {
    const auth = getAuth();
    const userId: any = auth.currentUser?.uid;

    delete sheetMusicToAdd.id

    // Add userId to sheet music
    if (userId) {
        sheetMusicToAdd.userId = userId
    } else {
        return false;
    }

    // Adding the new sheet music
    setLoadingAddSheetMusic(true)
    await putSheetMusic(sheetMusicToAdd)
        .then((value) => {
            if (value) {
                // callOpenAlert({ severity: "success", alertMessage: "Partitura cadastrada com sucesso!" })
                // Add new lyrics that haven't been registered yet
                sheetMusicToAdd.lyrics.map((lyric: any) => {
                    getRegisteredLyric(userId, lyric.lyricId)
                        .then((value: any) => {
                            if (!value) {
                                lyric.offset = 0
                                lyric.stars = 0
                                lyric.userId = userId
                                putUserLyricRegistered(lyric)
                                    .then(value => {
                                        console.log("Lyric registered success")
                                    })
                                    .catch(error => {
                                        console.log("Lyric register error")
                                    })
                            }
                        })
                        .catch(error => {
                            console.log(error)
                        })
                })

                setLoadingAddSheetMusic(false)
            }
        })
        .catch(() => {
            setLoadingAddSheetMusic(false)
            return false;
        })
}