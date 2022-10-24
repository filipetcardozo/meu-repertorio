import { getAuth } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";
import { getRegisteredLyric, putUserLyricRegistered, updateUserSheetMusic } from "../../providers/lyrics/services";

export function updateSheetMusic(sheetMusicToUpdate: any, setLoadingAddSheetMusic: any, enqueueSnackbar: any) {

    const auth = getAuth();
    const userId: any = auth.currentUser?.uid

    setLoadingAddSheetMusic(true)
    updateUserSheetMusic(sheetMusicToUpdate.id, sheetMusicToUpdate)
        .then((value: any) => {
            enqueueSnackbar("Partitura atualizada com sucesso!", { variant: "success" })
            setLoadingAddSheetMusic(false)
        })
        .catch((error) => {
            enqueueSnackbar("Ops... ocorreu algum erro.", { variant: "error" })
            setLoadingAddSheetMusic(false)
            return false;
        })

    // Add new lyrics that haven't been registered yet
    sheetMusicToUpdate.lyrics.map((lyric: any) => {
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

}