/* eslint-disable react-hooks/exhaustive-deps */
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { database } from "../../firebaseConfig";
import { getRegisteredLyric, getSheetMusic, putUserLyricRegistered, updateUserRegisteredLyricOffset, updateUserRegisteredLyricStars } from "../providers/lyrics/services";
import { normalizeOffset } from "../utils/chords/transpose";
import { useAuth } from "./useAuth";
import { useStorageSheetMusic } from "./useStorageSheetMusic";
import { lyricInSheetMusicType, sheetMusicType } from "../types/sheetMusicType";
import { registeredLyricType } from "../types/registeredLyricType";


export const useShowSheetMusic = ({ sheetMusicId }: { sheetMusicId: string }) => {
  const { uid } = useAuth()
  const db = database

  // Lyrics to show in this sheet
  let [sheetMusicToShow, setSheetMusicToShow] = useState<sheetMusicType>()

  // Lyrics registereds of this user
  let [userLyricsRegistered, setUserLyricsRegistered] = useState<registeredLyricType[]>()

  // Stepper
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<boolean[] | any>([]);
  const [startTime, setStartTime] = useState(new Date().getTime())
  const [readyToRender, setReadyToRender] = useState(false)

  // Offset salvo no banco de cada música (por lyricId), para saber se há mudança de tom a salvar
  const [savedOffsets, setSavedOffsets] = useState<Record<string, number>>({})
  const [offsetIsUpdating, setOffsetIsUpdating] = useState(false)
  const [openUpdatedSuccess, setOpenUpdatedSuccess] = useState(false);
  const [openUpdatedStarsSuccess, setOpenUpdatedStarsSuccess] = useState(false);

  const [starValueBefore, setStarValueBefore] = useState(0)
  const [startValueInLoading, setStarValueInLoading] = useState(0)
  const [starValueAfter, setStartValueAfter] = useState(0)
  const [displacementStart, setDisplacementStart] = useState(false)
  const [updatingStarsLoading, setUpdatingStarsLoading] = useState(false)

  const {
    callGetCompletedSheetMusicLocalStorage,
    callPutCompletedSheetMusicLocalStorage,
    callGetActiveLyricSheetMusicLocalStorage,
    callPutActiveLyricSheetMusicLocalStorage
  } = useStorageSheetMusic()

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

        allGetDocsRegistered.push(getRegisteredLyric(uid!, value.lyricId!))
      })

      await Promise.all(allGetDocs)
        .then(values => {
          values.forEach((lyric: any) => {
            let indexOf = sheet.lyrics.map(function (e: any) { return e.lyricId; }).indexOf(lyric.id)
            if (indexOf >= 0) {
              let dataOfLyricGet = lyric.data()
              sheet.lyrics[indexOf].composerId = dataOfLyricGet.composerId
              sheet.lyrics[indexOf].composerName = dataOfLyricGet.composerName
              sheet.lyrics[indexOf].composerImage = dataOfLyricGet.composerImage
              sheet.lyrics[indexOf].lyric = dataOfLyricGet.lyric
              sheet.lyrics[indexOf].lyricName = dataOfLyricGet.lyricName
              sheet.lyrics[indexOf].lyricStyle = dataOfLyricGet.lyricStyle
              sheet.lyrics[indexOf].originalTone = dataOfLyricGet.originalTone
              sheet.lyrics[indexOf].compactView = dataOfLyricGet.compactView
            }
          })
        })
        .then(values => {
          Promise.all(allGetDocsRegistered)
            .then((values: any) => {
              // Músicas ainda não cadastradas para o usuário vêm como undefined
              const registereds = (values as (registeredLyricType | undefined)[]).filter((v): v is registeredLyricType => !!v)
              setUserLyricsRegistered(registereds)
              registereds.forEach((lyricRegistered) => {
                let indexOf = sheet.lyrics.map(function (e: any) { return e.lyricId; }).indexOf(lyricRegistered.lyricId)
                if (indexOf >= 0) {
                  sheet.lyrics[indexOf].offset = normalizeOffset(lyricRegistered.offset)
                  sheet.lyrics[indexOf].stars = lyricRegistered.stars
                }
              })
              const offsets: Record<string, number> = {}
              sheet.lyrics.forEach((l: lyricInSheetMusicType) => {
                l.offset = normalizeOffset(l.offset)
                offsets[l.lyricId] = l.offset
              })
              setSavedOffsets(offsets)
              // Restaura a música em que o usuário estava (ex.: após F5).
              // Procura pelo lyricId primeiro, caso o repertório tenha sido reordenado.
              let initialStep = 0
              const storedActive = callGetActiveLyricSheetMusicLocalStorage(sheetMusicId)
              if (storedActive) {
                const byId = storedActive.lyricId
                  ? sheet.lyrics.findIndex((l: any) => l.lyricId === storedActive.lyricId)
                  : -1
                if (byId >= 0) initialStep = byId
                else if (storedActive.index >= 0 && storedActive.index < sheet.lyrics.length) initialStep = storedActive.index
              }

              setSheetMusicToShow(sheet)
              setActiveStep(initialStep)
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
      .then(() => {
        let completedStorage = callGetCompletedSheetMusicLocalStorage(sheetMusicId)
        if (completedStorage) {
          setCompleted(completedStorage)
        }
      })
  }, [])


  function handleNext() {
    if (sheetMusicToShow && activeStep === sheetMusicToShow.lyrics.length - 1 || !sheetMusicToShow) return;

    let diferenceOfTime = (new Date().getTime() - startTime) / 1000

    if (diferenceOfTime > 60) {
      completed[activeStep] = !completed[activeStep]
      setCompleted([...completed])

      setStartTime(new Date().getTime())
    }

    setActiveStep((prevActiveStep: any) => prevActiveStep + 1);
  }

  function handleBack() {
    if (activeStep == 0 || !sheetMusicToShow) return;

    let diferenceOfTime = (new Date().getTime() - startTime) / 1000

    if (diferenceOfTime > 60) {
      completed[activeStep] = !completed[activeStep]
      setCompleted([...completed])

      setStartTime(new Date().getTime())
    }

    setActiveStep((prevActiveStep: any) => prevActiveStep - 1);

  }

  function handleStep(step: number) {
    if (!sheetMusicToShow) return;

    let diferenceOfTime = (new Date().getTime() - startTime) / 1000

    if (activeStep === step || diferenceOfTime > 60) {
      completed[activeStep] = !completed[activeStep]
      setCompleted([...completed])

      setStartTime(new Date().getTime())
    }

    setActiveStep(step);
  }

  useEffect(() => {
    if (readyToRender) {
      callPutCompletedSheetMusicLocalStorage(sheetMusicId, completed)
    }
  }, [completed])

  // Salva a música atual para continuar nela ao recarregar a página
  useEffect(() => {
    if (readyToRender && sheetMusicToShow) {
      callPutActiveLyricSheetMusicLocalStorage(sheetMusicId, {
        index: activeStep,
        lyricId: sheetMusicToShow.lyrics[activeStep]?.lyricId
      })
    }
  }, [activeStep, readyToRender])

  const downHandler = ({ key }: any) => {
    if (key == "ArrowRight" || key == " ") handleNext()
    if (key == "ArrowLeft") handleBack()
    if (key == "Enter") {
      completed[activeStep] = !completed[activeStep]
      setCompleted([...completed])
    }
  };

  /** Muda o tom da música atual em `semitones` (+1 sobe meio tom, -1 desce). */
  function changeOffSet(semitones: number) {
    setSheetMusicToShow((prev) => {
      const current = prev?.lyrics?.[activeStep]
      if (!prev || !current) return prev
      const lyrics = prev.lyrics.slice()
      lyrics[activeStep] = { ...current, offset: normalizeOffset((current.offset ?? 0) + semitones) }
      return { ...prev, lyrics }
    })
  }

  async function updateOffset() {
    const current = sheetMusicToShow?.lyrics[activeStep]
    if (!current || offsetIsUpdating) return;

    const offset = current.offset ?? 0
    setOffsetIsUpdating(true)
    try {
      const registered = userLyricsRegistered?.find((r) => r.lyricId === current.lyricId)
      if (registered?.id) {
        await updateUserRegisteredLyricOffset(registered.id, offset)
      } else {
        // Música ainda não cadastrada para o usuário: cadastra já com o novo tom
        const newRegistered: registeredLyricType = {
          composerId: current.composerId,
          composerName: current.composerName,
          lyricId: current.lyricId,
          lyricName: current.lyricName,
          lyricStyle: current.lyricStyle ?? '',
          originalTone: current.originalTone ?? '',
          offset,
          stars: current.stars ?? 0,
          userId: uid as string,
        }
        const id = await putUserLyricRegistered(newRegistered)
        setUserLyricsRegistered((prev) => [...(prev ?? []), { ...newRegistered, id }])
      }
      setSavedOffsets((prev) => ({ ...prev, [current.lyricId]: offset }))
      setOpenUpdatedSuccess(true)
    } catch (err) {
      console.error('Error: ', err)
    } finally {
      setOffsetIsUpdating(false)
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
    if (!sheetMusicToShow || !newStar || !userLyricsRegistered) return;

    let activeLyric = sheetMusicToShow.lyrics[activeStep];
    if (!activeLyric) return;

    let indexOfLyricToUpdate = userLyricsRegistered.findIndex(e => e.lyricId === activeLyric.lyricId);
    if (indexOfLyricToUpdate < 0) return;

    // Se stars for undefined, atribua um valor padrão (por exemplo, 0)
    let currentStars = activeLyric.stars ?? 0;

    // Iniciar atualização
    setUpdatingStarsLoading(true);
    setStarValueBefore(currentStars);
    setStarValueInLoading(currentStars);
    setStartValueAfter(newStar);

    let idToRegisteredUpdateOffset = userLyricsRegistered[indexOfLyricToUpdate].id;
    await updateUserRegisteredLyricStars(idToRegisteredUpdateOffset, newStar)
      .then(() => {
        activeLyric.stars = newStar; // Atualiza as estrelas do lyric ativo
        // setSheetMusicToShow({ ...sheetMusicToShow });

        // Displacement start in stars
        setDisplacementStart(true);
        setUpdatingStarsLoading(false);
      });
  }


  const lyricToShow = sheetMusicToShow?.lyrics[activeStep]

  // Por música do repertório: tom salvo, tom atual e se há mudança a salvar
  const offsetsUpdateds = useMemo(
    () => (sheetMusicToShow?.lyrics ?? []).map((l) => {
      const offsetBefore = savedOffsets[l.lyricId] ?? 0
      const offsetNow = l.offset ?? 0
      return { offsetBefore, offsetNow, offsetChanged: offsetBefore !== offsetNow }
    }),
    [sheetMusicToShow, savedOffsets],
  )

  const handleCloseUpdatedSuccess = (event?: React.SyntheticEvent | Event | null, reason?: string) => {
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