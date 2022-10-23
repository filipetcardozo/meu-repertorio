import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { database } from "../../firebaseConfig";
import { getSheetMusic, getSpecificUserRegisteredLyrics, updateUserRegisteredLyricOffset, updateUserRegisteredLyricStars } from "../providers/lyrics/service";
import { useAuth } from "./useAuth";


export const useShowSheetMusic = ({ sheetMusicId }: { sheetMusicId: string }) => {
    const { uid } = useAuth()
    const db = database

    const [lyricToShow, setLyricToShow] = useState<any>({})

    // Lyrics to show in this sheet
    let [sheetMusicToShow, setSheetMusicToShow] = useState<any>({ lyrics: [{ offset: 0 }] })

    // Lyrics registereds of this user
    let [userLyricsRegistered, setUserLyricsRegistered] = useState<any>([])

    // Stepper
    const [activeStep, setActiveStep] = useState(0);
    const [completed, setCompleted] = useState<boolean[]>([]);
    const [startTime, setStartTime] = useState(new Date().getTime())
    const [readyToRender, setReadyToRender] = useState(false)

    const [offsetsUpdateds, setOffsetsUpdateds] = useState<any[]>([])
    const [offsetIsUpdating, setOffsetIsUpdating] = useState(false)
    const [openUpdatedSuccess, setOpenUpdatedSuccess] = useState(false);
    const [openUpdatedStarsSuccess, setOpenUpdatedStarsSuccess] = useState(false);

    const [starValueBefore, setStarValueBefore] = useState(0)
    const [startValueInLoading, setStarValueInLoading] = useState(0)
    const [starValueAfter, setStartValueAfter] = useState(0)
    const [displacementStart, setDisplacementStart] = useState(false)
    const [updatingStarsLoading, setUpdatingStarsLoading] = useState(false)

    // Request of the sheet music and later of each song individually
    const getSheet = async () => {
        let sheet: any
        if (sheetMusicId) {
            sheet = await getSheetMusic(sheetMusicId)

            let allGetDocs: any = []
            let allGetDocsRegistered: any = []

            // All get docs in db lyrics
            sheet.lyrics.map((value: any, index: number) => {
                const docRef = doc(db, "lyrics", value.lyricId)
                allGetDocs.push(getDoc(docRef))

                allGetDocsRegistered.push(getSpecificUserRegisteredLyrics(uid!, value.lyricId))
            })

            Promise.all(allGetDocs)
                .then(values => {
                    values.forEach((lyric: any) => {
                        let indexOf = sheet.lyrics.map(function (e: any) { return e.lyricId; }).indexOf(lyric.id)
                        if (indexOf >= 0) {
                            let dataOfLyricGet = lyric.data()
                            sheet.lyrics[indexOf].composerId = dataOfLyricGet.composerId
                            sheet.lyrics[indexOf].composerName = dataOfLyricGet.composerName
                            sheet.lyrics[indexOf].lyric = dataOfLyricGet.lyric
                            sheet.lyrics[indexOf].lyricName = dataOfLyricGet.lyricName
                            sheet.lyrics[indexOf].lyricStyle = dataOfLyricGet.lyricStyle
                            sheet.lyrics[indexOf].originalTone = dataOfLyricGet.originalTone
                        }
                    })
                })
                .then(values => {
                    Promise.all(allGetDocsRegistered)
                        .then((values) => {
                            setUserLyricsRegistered(values)
                            values.forEach((lyricRegistered: any) => {
                                let indexOf = sheet.lyrics.map(function (e: any) { return e.lyricId; }).indexOf(lyricRegistered.lyricId)
                                if (indexOf >= 0) {
                                    sheet.lyrics[indexOf].offset = lyricRegistered.offset
                                    sheet.lyrics[indexOf].stars = lyricRegistered.stars
                                }
                            })
                            setSheetMusicToShow(sheet)
                            setLyricToShow(sheet.lyrics[0])
                            setReadyToRender(true)
                        })
                })
                .catch(errors => {
                    console.log(errors)
                })
        }
    }

    useEffect(() => {
        getSheet()
    }, [])

    function handleNext() {
        if (activeStep == sheetMusicToShow.lyrics.length - 1) return;

        let diferenceOfTime = (new Date().getTime() - startTime) / 1000

        if (diferenceOfTime > 60) {
            completed[activeStep] = !completed[activeStep]
            setCompleted([...completed])

            setStartTime(new Date().getTime())
        }

        setActiveStep((prevActiveStep: any) => prevActiveStep + 1);
        setLyricToShow(sheetMusicToShow.lyrics[activeStep + 1])
    }

    function handleBack() {
        if (activeStep == 0) return;

        let diferenceOfTime = (new Date().getTime() - startTime) / 1000

        if (diferenceOfTime > 60) {
            completed[activeStep] = !completed[activeStep]
            setCompleted([...completed])

            setStartTime(new Date().getTime())
        }

        setActiveStep((prevActiveStep: any) => prevActiveStep - 1);
        setLyricToShow(sheetMusicToShow.lyrics[activeStep - 1])

    }

    function handleStep(step: number) {
        let diferenceOfTime = (new Date().getTime() - startTime) / 1000

        if (activeStep === step || diferenceOfTime > 60) {
            completed[activeStep] = !completed[activeStep]
            setCompleted([...completed])

            setStartTime(new Date().getTime())
        }

        setActiveStep((prevActiveStep: any) => step);
        setLyricToShow(sheetMusicToShow.lyrics[step])
    }

    const downHandler = ({ key }: any) => {
        if (key == "ArrowRight" || key == " ") handleNext()
        if (key == "ArrowLeft") handleBack()
        if (key == "Enter") {
            completed[activeStep] = !completed[activeStep]
            setCompleted([...completed])
        }
    };

    async function changeOffSet(increaseOrDecrease: boolean) {
        let value = 0
        increaseOrDecrease ? value = 1 : value = -1

        let newOffset = sheetMusicToShow.lyrics[activeStep].offset += value
        if (newOffset > 11 || newOffset < -11) {
            newOffset = 0
        }

        sheetMusicToShow.lyrics[activeStep].offset = newOffset
        setSheetMusicToShow({ ...sheetMusicToShow })

        // For the updated offset
        offsetsUpdateds[activeStep].offsetNow = newOffset
        if (offsetsUpdateds[activeStep].offsetBefore != newOffset) {
            offsetsUpdateds[activeStep].offsetChanged = true
        } else {
            offsetsUpdateds[activeStep].offsetChanged = false
        }
        setOffsetsUpdateds([...offsetsUpdateds])
    }

    async function updateOffset() {
        setOffsetIsUpdating(true)

        // Update in registered lyrics the new offset
        let newOffset = offsetsUpdateds[activeStep].offsetNow
        let indexOfLyricToUpdate = userLyricsRegistered.map(function (e: any) { return e.lyricId; }).indexOf(sheetMusicToShow.lyrics[activeStep].lyricId)
        if (indexOfLyricToUpdate >= 0) {
            let idToRegisteredUpdateOffset = userLyricsRegistered[indexOfLyricToUpdate].id
            await updateUserRegisteredLyricOffset(idToRegisteredUpdateOffset, newOffset)
                .then(() => {
                    offsetsUpdateds[activeStep].offsetBefore = newOffset
                    offsetsUpdateds[activeStep].offsetChanged = false
                    setOffsetsUpdateds([...offsetsUpdateds])
                    setOffsetIsUpdating(false)
                    setOpenUpdatedSuccess(true)
                })
        }
    }

    useEffect(() => {
        if (displacementStart) {
            setTimeout(() => {
                if (startValueInLoading > starValueAfter) {
                    setStarValueInLoading(startValueInLoading - 1)
                } else if (startValueInLoading < starValueAfter) {
                    setStarValueInLoading(startValueInLoading + 1)
                } else if (startValueInLoading == starValueAfter) {
                    setDisplacementStart(false)
                    setOpenUpdatedStarsSuccess(true)
                    // setUpdatingStarsLoading(false)
                }
            }, 50)
        }
    }, [startValueInLoading, displacementStart])

    async function updateStars(newStar: any) {
        let indexOfLyricToUpdate = userLyricsRegistered.map(function (e: any) { return e.lyricId; }).indexOf(sheetMusicToShow.lyrics[activeStep].lyricId)
        if (indexOfLyricToUpdate >= 0) {
            if (!newStar) return;

            // Temporary for loading update stars
            // setUpdatingStars(true)
            setUpdatingStarsLoading(true)
            setStarValueBefore(sheetMusicToShow.lyrics[activeStep].stars)
            setStarValueInLoading(sheetMusicToShow.lyrics[activeStep].stars)
            setStartValueAfter(newStar)

            let idToRegisteredUpdateOffset = userLyricsRegistered[indexOfLyricToUpdate].id
            await updateUserRegisteredLyricStars(idToRegisteredUpdateOffset, newStar)
                .then(() => {
                    sheetMusicToShow.lyrics[activeStep].stars = newStar
                    setSheetMusicToShow({ ...sheetMusicToShow })

                    // Displacement start in stars
                    setDisplacementStart(true)
                    setUpdatingStarsLoading(false)
                })
        }
    }

    useEffect(() => {
        if (readyToRender) {
            sheetMusicToShow.lyrics.map((value: any) => {
                offsetsUpdateds.push({ offsetBefore: value.offset, offsetChanged: false })
            })
            setOffsetsUpdateds([...offsetsUpdateds])
        }
    }, [readyToRender])

    const handleCloseUpdatedSuccess = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenUpdatedSuccess(false);
        setOpenUpdatedStarsSuccess(false);
    };

    return {
        sheetMusicToShow,
        userLyricsRegistered,
        activeStep,
        completed,
        startTime,
        readyToRender,
        lyricToShow,
        handleNext,
        handleBack,
        handleStep,
        downHandler,
        changeOffSet,
        openUpdatedSuccess,
        openUpdatedStarsSuccess,
        updateOffset,
        updateStars,
        startValueInLoading,
        starValueBefore,
        starValueAfter,
        displacementStart,
        updatingStarsLoading,
        offsetsUpdateds,
        offsetIsUpdating,
        handleCloseUpdatedSuccess,
        setSheetMusicToShow
    }
}