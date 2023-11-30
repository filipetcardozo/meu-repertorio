/* eslint-disable react-hooks/exhaustive-deps */
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/router";
import React from 'react';
import { LyricShowComponent } from ".";
import { useOneLyricShow } from "../../hooks/useOneLyricShow";

export const LyricShowPage = () => {
  const router = useRouter()
  const { id } = router.query

  let lyricId = Array.isArray(id) ? "" : id as string;

  const {
    registeredLyric,
    oldOffset,
    offsetChanged,
    offsetIsUpdating,
    changeOffSet,
    updateOffset
  } = useOneLyricShow(lyricId)

  if (!registeredLyric || !registeredLyric.lyric) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return <Box display="flex" justifyContent="center" >
    <Box px={3} py={2} sx={{ backgroundColor: "#1976d212", borderRadius: 1.4, boxShadow: 2 }}>
      <LyricShowComponent lyricToShow={registeredLyric} offsetLyricToShow={registeredLyric.offset}
        newOffset={oldOffset} isOneLyric={true} changeOffSet={changeOffSet}
        offsetChanged={offsetChanged} offsetIsUpdating={offsetIsUpdating}
        updateOffset={updateOffset}
      />
    </Box>
  </Box>
}