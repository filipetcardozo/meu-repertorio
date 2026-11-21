/* eslint-disable react-hooks/exhaustive-deps */
import { alpha, Box, CircularProgress } from "@mui/material";
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return <Box sx={{ display: 'flex', justifyContent: 'center' }} >
    <Box sx={{
      px: { xs: 1.5, md: 3 },
      py: 2,
      width: { xs: '100%', md: 'auto' },
      minWidth: 0,
      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
      borderRadius: { xs: 0, md: 1.4 },
      boxShadow: { xs: 0, md: 2 },
    }}>
      <LyricShowComponent lyricToShow={registeredLyric} offsetLyricToShow={registeredLyric.offset}
        newOffset={oldOffset} isOneLyric={true} changeOffSet={changeOffSet}
        offsetChanged={offsetChanged} offsetIsUpdating={offsetIsUpdating}
        updateOffset={updateOffset}
      />
    </Box>
  </Box>
}