import { GiConsoleController } from "react-icons/gi"
import { getAuth } from "firebase/auth";
import { getSpecificUserRegisteredLyrics, putSheetMusic, putUserLyricRegistered } from "../../providers/lyrics/service";

export function registerSheetMusic(sheetMusicToAdd: any, setLoadingAddSheetMusic: any, callOpenAlert: any) {
    const auth = getAuth();
    const userId: any = auth.currentUser?.uid

    delete sheetMusicToAdd.id

    // Add userId to sheet music
    if (userId) {
        sheetMusicToAdd.userId = userId
    } else {
        console.log(userId)
        console.log('Some problem in add userId')
        return false;
    }

    // Adding the new sheet music
    setLoadingAddSheetMusic(true)
    putSheetMusic(sheetMusicToAdd)
        .then((value) => {
            if (value) {
                callOpenAlert({ severity: "success", alertMessage: "Partitura cadastrada com sucesso!" })

                setLoadingAddSheetMusic(false)
            }
        })
        .catch((error) => {
            callOpenAlert({ severity: "error", alertMessage: "Ops... algum problema ocorreu!" })
            setLoadingAddSheetMusic(false)
            return false;
        })

    // Add new lyrics that haven't been registered yet
    sheetMusicToAdd.lyrics.map((lyric: any) => {
        getSpecificUserRegisteredLyrics(userId, lyric.lyricId)
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

}