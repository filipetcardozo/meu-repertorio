/* eslint-disable react-hooks/exhaustive-deps */
import { registeredLyricType } from "../types/registeredLyricType";
import React, { useEffect, useState } from 'react'
import { getLyric, getRegisteredLyric, putUserLyricRegistered, updateUserRegisteredLyricOffset } from "../providers/lyrics/services";
import { useAuth } from "./useAuth";
import { useRouter } from "next/router";

export const useOneLyricShow = (idLyric: string) => {
  const { uid } = useAuth()
  const router = useRouter()
  const { id } = router.query

  const [registeredLyric, setRegisteredLyric] = useState({} as registeredLyricType)
  const [oldOffset, setOldOffset] = useState<number>()
  const [offsetChanged, setOffsetChanged] = useState(false)
  const [offsetIsUpdating, setOffsetIsUpdating] = useState(false)

  useEffect(() => {
    Promise.all([
      getRegisteredLyric(uid!, id!)
        .then((value) => {
          return value;
        })
        .catch(err => {
          console.error('Error: ', err)
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
          newObj = values[0];
          newObj.lyric = values[1].lyric;
          setOldOffset(newObj.offset);
        } else {
          newObj = values[1];
          newObj.lyricId = newObj.id!;
          newObj.offset = 0;
          newObj.stars = 1;
          setOldOffset(0);

          delete newObj.id;
        }

        setRegisteredLyric(newObj);
      })
  }, [])

  async function changeOffSet(increaseOrDecrease: boolean) {
    let value = 0
    increaseOrDecrease ? value = 1 : value = -1

    let newOffset = registeredLyric.offset + value
    if (newOffset > 11 || newOffset < -11) {
      newOffset = 0
    }

    registeredLyric.offset = newOffset
    setRegisteredLyric({ ...registeredLyric })

    if (newOffset == oldOffset) {
      setOffsetChanged(false)
    } else {
      setOffsetChanged(true)
    }
  }

  async function updateOffset() {
    setOffsetIsUpdating(true)

    if (registeredLyric && registeredLyric.userId) {
      await updateUserRegisteredLyricOffset(registeredLyric.id, registeredLyric.offset)
        .then(() => {
          setOldOffset(registeredLyric.offset);
          setOffsetIsUpdating(false);
          setOffsetChanged(false);
        })
        .catch((err) => {
          console.error('Error: ', err)
        })
    } else {
      await putUserLyricRegistered({ ...registeredLyric, userId: uid as string })
        .then(registeredLyricId => {
          setRegisteredLyric({ ...registeredLyric, id: registeredLyricId });

          setOldOffset(registeredLyric.offset);
          setOffsetIsUpdating(false);
          setOffsetChanged(false);
        })
    }


  }

  return {
    registeredLyric,
    oldOffset,
    offsetChanged,
    offsetIsUpdating,
    updateOffset,
    changeOffSet
  }
}