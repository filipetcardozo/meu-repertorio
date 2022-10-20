import { getAuth } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";
import { getSpecificUserRegisteredLyrics, putUserLyricRegistered, updateUserSheetMusic } from "../../providers/lyrics/service";

export function updateSheetMusic(sheetMusicToUpdate: any, setLoadingAddSheetMusic: any, setOpenAlertUpdateSheetMusic: any) {
    
    const auth = getAuth();
    const userId: any = auth.currentUser?.uid

    setLoadingAddSheetMusic(true)
    updateUserSheetMusic(sheetMusicToUpdate.id, sheetMusicToUpdate)
        .then((value: any) => {
            setOpenAlertUpdateSheetMusic(true)
            setLoadingAddSheetMusic(false)
        })
        .catch((error) => {
            console.log('Error in update sheet music')
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