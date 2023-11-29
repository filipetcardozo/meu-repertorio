/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from "react"
import { getLyricsServices } from "../providers/lyrics"
import { useAuth } from "./useAuth"
import { useStorageSheetMusic } from "./useStorageSheetMusic"
import { sheetMusicType } from "../types/sheetMusicType"
// import { useAuth } from "../user"

export const useSheetsMusics = () => {
  const getLyrics = getLyricsServices()

  const [sheetsMusics, setSheetsMusics] = useState<sheetMusicType[]>([])

  const { isLogged, uid } = useAuth()

  const { callGetCompletedSheetMusicLocalStorage } = useStorageSheetMusic()

  useEffect(() => {
    if (isLogged) {
      getLyrics.getAllSheetsMusics(uid!)
        .then((sheets) => {
          sheets.map((v, index) => {
            let completedValues: boolean[] = callGetCompletedSheetMusicLocalStorage(v.id!) as boolean[]
            if (completedValues && completedValues.length > 0) {
              let count = completedValues.filter((value: any) => value === true).length;
              sheets[index].completed = count
            }
          })

          sheets.sort((a, b) => {
            const aLastUpdated = a.lastUpdated ? a.lastUpdated.toMillis() : 0;
            const bLastUpdated = b.lastUpdated ? b.lastUpdated.toMillis() : 0;
            return bLastUpdated - aLastUpdated;
          });

          setSheetsMusics(sheets)
        })
    }
  }, [])

  return {
    sheetsMusics,
    setSheetsMusics
  }

}