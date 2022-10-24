/* eslint-disable react-hooks/exhaustive-deps */
import { registeredLyricType } from "../types/registeredLyricType";
import React, { useEffect, useState } from 'react'
import { getLyric, getRegisteredLyric, updateUserRegisteredLyricOffset } from "../providers/lyrics/services";
import { useAuth } from "./useAuth";
import { useRouter } from "next/router";

export const useOneLyricShow = (idLyric: string) => {
    const { uid } = useAuth()
    const router = useRouter()
    const { id } = router.query

    const [lyric, setLyric] = useState({} as registeredLyricType)
    const [oldOffset, setOldOffset] = useState<number>()
    const [offsetChanged, setOffsetChanged] = useState(false)
    const [offsetIsUpdating, setOffsetIsUpdating] = useState(false)

    useEffect(() => {
        Promise.all([
            getRegisteredLyric(uid!, id!)
                .then((value: any) => {
                    return value
                })
                .catch(error => {
                }),
            getLyric(idLyric!)
                .then((lyric) => {
                    return lyric
                })
                .catch(() => {
                })
        ])
            .then((values: any) => {
                let newObj: registeredLyricType

                if (values[0]) {
                    newObj = values[0]
                    newObj.lyric = values[1].lyric
                    setOldOffset(newObj.offset)
                } else {
                    newObj = values[1]
                    newObj.lyricId = newObj.id!
                    newObj.offset = 0
                    newObj.stars = 1
                    setOldOffset(0)
                }

                setLyric(newObj)
            })
    }, [])

    async function changeOffSet(increaseOrDecrease: boolean) {
        let value = 0
        increaseOrDecrease ? value = 1 : value = -1

        let newOffset = lyric.offset + value
        if (newOffset > 11 || newOffset < -11) {
            newOffset = 0
        }

        lyric.offset = newOffset
        setLyric({ ...lyric })
        
        if (newOffset == oldOffset) {
            setOffsetChanged(false)
        } else {
            setOffsetChanged(true)
        }
    }

    async function updateOffset() {
        setOffsetIsUpdating(true)

        await updateUserRegisteredLyricOffset(lyric.id, lyric.offset)
            .then(() => {
                setOldOffset(lyric.offset)

                setOffsetIsUpdating(false)
                setOffsetChanged(false)
            })

    }

    return {
        lyric,
        oldOffset,
        offsetChanged,
        offsetIsUpdating,
        updateOffset,
        changeOffSet
    }
}