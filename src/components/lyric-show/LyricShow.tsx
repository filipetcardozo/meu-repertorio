/* eslint-disable react-hooks/exhaustive-deps */
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import React, { useEffect, useState } from 'react';
import { LyricShowComponent } from ".";
import { useAuth } from "../../hooks/useAuth";
import { useOneLyricShow } from "../../hooks/useOneLyricShow";
import { getLyric, getRegisteredLyric } from "../../providers/lyrics/services";
import { getLyricType } from "../../types/lyricType";
import { getRegisteredLyricType, registeredLyricType } from "../../types/registeredLyricType";
import LyricShow from "../../pages/lyric/lyric-show/[id]";

export const LyricShowPage = () => {
    const router = useRouter()
    const { id } = router.query

    let lyricId = Array.isArray(id) ? "" : id as string;

    const {
        lyric,
        oldOffset,
        offsetChanged,
        offsetIsUpdating,
        changeOffSet,
        updateOffset
    } = useOneLyricShow(lyricId)


    // enqueueSnackbar("Ops... essa música não existe!", { variant: "error" })

    return <Box display="flex" justifyContent="center" >
        <Box px={3} py={2} sx={{ backgroundColor: "#1976d212", borderRadius: 1.4, boxShadow: 2 }}>
            <LyricShowComponent lyricToShow={lyric} offsetLyricToShow={lyric.offset}
                newOffset={oldOffset} isOneLyric={true} changeOffSet={changeOffSet}
                offsetChanged={offsetChanged} offsetIsUpdating={offsetIsUpdating}
                updateOffset={updateOffset}
            />
        </Box>
    </Box>
}