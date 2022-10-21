import { useEffect, useState } from "react"
import { registerSheetMusic } from "../components/sheet-music-manage/registerSheetMusic"
import { updateSheetMusic } from "../components/sheet-music-manage/updateSheetMusic"
import { deleteSheetMusic, getAllSheetsMusics, getSheetMusic } from "../providers/lyrics/service"
import { useAlert } from "./useAlert"
import { useAuth } from "./useAuth"


export const useSheetMusicManage = ({ sheetMusicId }: { sheetMusicId: any }) => {
    const [lyrics, setLyrics] = useState<any>([])
    const [sheetMusicToAdd, setSheetMusicToAdd] = useState<any>({
        id: "",
        sheetMusicName: "",
        description: "",
        userId: "",
        lyrics: [{
            composerName: "",
            composerId: "",
            originalTone: "",
            lyricStyle: "",
            lyricName: "",
            lyricId: ""
        }]
    })
    const [lyricsToAdd, setLyricsToAdd] = useState<any[]>([])
    const [sheetsMusics, setSheetsMusics] = useState<any[]>([])
    const [filteredValue, setFilteredValue] = useState("Todas as músicas")
    const [loadingAddSheetMusic, setLoadingAddSheetMusic] = useState(false)

    const {
        alertMessage,
        openAlert,
        severity,
        handleCloseAlert,
        setAlertMessage,
        setOpenAlert,
        setSeverity,
        callOpenAlert
    } = useAlert()

    useEffect(() => {
        if (sheetMusicId) {
            getSheetMusic(sheetMusicId)
                .then((value) => {
                    if (value) {
                        console.log("Sheet Music for change:")
                        console.log(value)
                        sheetMusicToAdd.id = value.id
                        sheetMusicToAdd.description = value.description
                        sheetMusicToAdd.sheetMusicName = value.sheetMusicName
                        sheetMusicToAdd.userId = value.userId
                        sheetMusicToAdd.lyrics = value.lyrics

                        setLyricsToAdd(value.lyrics)

                        setSheetMusicToAdd({ ...sheetMusicToAdd })
                    } else {
                        // redirect('/app/sheet-music-create')
                        console.log("Invalid id of Sheet Music")
                    }
                })
                .catch((error) => {
                    console.log("Error in get sheet music of id: " + error)
                })
        }
    }, [])

    useEffect(() => {
        if (filteredValue.startsWith("Partitura:")) {
            let newFiltered = sheetsMusics.filter((el) => el.sheetMusicName == filteredValue.replace("Partitura: ", ""))

            if (newFiltered.length > 0) setLyrics(newFiltered[0].lyrics);
        }

        if (filteredValue.startsWith("Gênero:")) {
            console.log("GENNNERO")
        }

    }, [filteredValue])

    const handleDeleteSheetMusic = () => {
        deleteSheetMusic(sheetMusicId)
            .then((value) => {
                console.log('heree')
            })
            .catch((er) => {
                console.log('Error in delete sheet music')
            })
    }

    const handleAddSheetMusic = async () => {
        sheetMusicToAdd.lyrics = lyricsToAdd
        setSheetMusicToAdd({ ...sheetMusicToAdd })

        // debugger
        if (sheetMusicId != "") {
            updateSheetMusic(sheetMusicToAdd, setLoadingAddSheetMusic, callOpenAlert)
        } else {
            registerSheetMusic(sheetMusicToAdd, setLoadingAddSheetMusic, callOpenAlert)
        }
    }

    const handlePushMusicToSheets = (lyricToAdd: any) => {
        // Verify if alredy exists
        let filterLyrics = lyricsToAdd.filter((values) => values.lyricId == lyricToAdd.lyricId).length
        if (filterLyrics > 0) {
            // setOpenAlertAlredyAdd(true)
            return;
        }

        // Adding the new music if not alredy included
        delete lyricToAdd.lyric
        setLyricsToAdd([...lyricsToAdd, lyricToAdd])
    }

    const handleDeleteMusicSheet = (index: number) => {
        // Excluindo a musica
        lyricsToAdd.splice(index, 1)
        setLyricsToAdd([...lyricsToAdd])
    }

    return {
        lyrics,
        sheetMusicToAdd,
        lyricsToAdd,
        sheetsMusics,
        filteredValue,
        loadingAddSheetMusic,
        setFilteredValue,
        setSheetMusicToAdd,
        setLyricsToAdd,
        handleDeleteSheetMusic,
        handleAddSheetMusic,
        handlePushMusicToSheets,
        handleDeleteMusicSheet,
        alertMessage,
        openAlert,
        severity,
        handleCloseAlert,
        setAlertMessage,
        setOpenAlert,
        setSeverity
    }
}