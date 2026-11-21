/* eslint-disable react-hooks/exhaustive-deps */
import { registeredLyricType } from "../types/registeredLyricType";
import { useEffect, useState } from 'react'
import { getLyric, getRegisteredLyric, putUserLyricRegistered, updateUserRegisteredLyricOffset } from "../providers/lyrics/services";
import { normalizeOffset } from "../utils/chords/transpose";
import { useAuth } from "./useAuth";
import { useRouter } from "next/router";

export const useOneLyricShow = (idLyric: string) => {
  const { uid } = useAuth()
  const router = useRouter()
  const { id } = router.query

  const [registeredLyric, setRegisteredLyric] = useState<registeredLyricType>()
  // Offset salvo no banco (para saber se há mudança de tom a salvar)
  const [oldOffset, setOldOffset] = useState<number>()
  const [offsetIsUpdating, setOffsetIsUpdating] = useState(false)
  const offsetChanged = !!registeredLyric && oldOffset !== undefined && registeredLyric.offset !== oldOffset

  useEffect(() => {
    if (id) {
      setRegisteredLyric(undefined);
      setOldOffset(undefined);
      setOffsetIsUpdating(false);

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
            // Tom original vem da música (pode ter sido atualizado do Cifra Club depois do cadastro do usuário)
            if (values[1].originalTone) newObj.originalTone = values[1].originalTone;
            newObj.composerImage = values[1].composerImage;
            newObj.compactView = values[1].compactView;
            newObj.offset = normalizeOffset(newObj.offset);
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
    }
  }, [id])

  /** Muda o tom em `semitones` (+1 sobe meio tom, -1 desce). */
  function changeOffSet(semitones: number) {
    setRegisteredLyric((prev) => prev && { ...prev, offset: normalizeOffset((prev.offset ?? 0) + semitones) })
  }

  async function updateOffset() {
    if (!registeredLyric || offsetIsUpdating) return;

    const offset = registeredLyric.offset
    setOffsetIsUpdating(true)
    try {
      if (registeredLyric.id) {
        await updateUserRegisteredLyricOffset(registeredLyric.id, offset)
      } else {
        // Primeira vez: cadastra a música para o usuário (guardando id e userId para não duplicar)
        const userId = uid as string
        const id = await putUserLyricRegistered({ ...registeredLyric, userId })
        setRegisteredLyric((prev) => prev && { ...prev, id, userId })
      }
      setOldOffset(offset)
    } catch (err) {
      console.error('Error: ', err)
    } finally {
      setOffsetIsUpdating(false)
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