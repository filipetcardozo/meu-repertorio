import { getAuth } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";
import { getSpecificUserRegisteredLyrics, putUserLyricRegistered, updateUserSheetMusic } from "../../providers/lyrics/service";

export function updateSheetMusic(sheetMusicToUpdate: any, setLoadingAddSheetMusic: any, callOpenAlert: any) {

    const auth = getAuth();
    const userId: any = auth.currentUser?.uid

    setLoadingAddSheetMusic(true)
    updateUserSheetMusic(sheetMusicToUpdate.id, sheetMusicToUpdate)
        .then((value: any) => {
            callOpenAlert({ severity: "success", alertMessage: "Partitura atualizada com sucesso!" })
            setLoadingAddSheetMusic(false)
        })
        .catch((error) => {
            callOpenAlert({ severity: "error", alertMessage: "Ops... algum erro ocorreu." })
            setLoadingAddSheetMusic(false)
            return false;
        })

    // Add new lyrics that haven't been registered yet
    sheetMusicToUpdate.lyrics.map((lyric: any) => {
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