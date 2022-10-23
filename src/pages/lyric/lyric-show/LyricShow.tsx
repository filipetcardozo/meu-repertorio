import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import React, { useEffect } from 'react';
import { useAuth } from "../../../hooks/useAuth";
import { getLyric, getSpecificUserRegisteredLyrics } from "../../../providers/lyrics/service";

export const LyricShowPage = () => {
    const router = useRouter()
    const { id } = router.query
    const { uid } = useAuth()
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        getSpecificUserRegisteredLyrics(uid!, id)
            .then((value: any) => {
                if (!value) {
                    getLyric(id)
                        .then((lyric) => {
                            if (!lyric) {
                                enqueueSnackbar("Ops... essa música não existe!", { variant: "error" })
                            } else {
                                enqueueSnackbar("Obaa!! Música existente!", { variant: "success" })
                            }
                        })
                        .catch(() => {
                        })
                }
                enqueueSnackbar("Obaa!! Música existente!", { variant: "success" })
            })
            .catch(error => {
                console.log(error)
            })
    }, [])

    return <>

    </>
}