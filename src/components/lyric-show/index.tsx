/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { Markup } from 'interweave';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import NextPlanIcon from '@mui/icons-material/NextPlan';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/router';
import { useLyricShow } from '../../hooks/useLyricShow';
import { writeTone } from '../../utils/writeTone';

const ThemedTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[1],
    fontSize: 11,
  },
}));

export const LyricShowComponent = ({
  changeOffSet,
  handleNext,
  lyricToShow,
  nextLyricToShow,
  offsetsUpdateds,
  updateOffset,
  offsetIsUpdating,
  offsetLyricToShow,
  isOneLyric,
  offsetChanged
}: any) => {
  const router = useRouter();

  const {
    lengthSecondColumn,
    htmlLyric,
    htmlLyricNextMusic,
    htmlLyricSecond,
    htmlLyricThird
  } = useLyricShow({
    lyricToShow,
    offsetLyricToShow,
    nextLyricToShow,
  });

  function FirstColumn() {
    if (!htmlLyric) return null;

    return (
      <Box display='inline' className='lyric-show'>
        <Stack direction='row' spacing={2} alignItems='center' justifyContent='center'>
          <Typography variant='h6' fontSize={15} color='text.primary'>
            {lyricToShow.lyricName + ' '}
            <Box component='span' fontSize={11} color='text.secondary'>
              ({lyricToShow.composerName})
            </Box>
          </Typography>

          <Badge
            color='info'
            anchorOrigin={{
              vertical: 'top',
              horizontal: lyricToShow.offset > 0 ? 'right' : 'left',
            }}
            badgeContent={offsetLyricToShow > 0 ? '+' + offsetLyricToShow : offsetLyricToShow}
          >
            <Stack
              direction='row'
              justifyContent='center'
              alignItems='center'
              spacing={0}
              sx={(theme) => ({
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                borderRadius: 3,
                backgroundColor: alpha(theme.palette.primary.main, 0.06),
              })}
            >
              <IconButton
                aria-label='decrementar tom'
                size='small'
                onClick={() => { changeOffSet(false); }}
              >
                <RemoveIcon sx={(theme) => ({ color: alpha(theme.palette.primary.main, 0.65) })} fontSize='inherit' />
              </IconButton>

              <Box
                display='flex'
                alignItems='center'
                justifyContent='center'
                sx={(theme) => ({
                  width: 25,
                  height: 25,
                  color: theme.palette.primary.main,
                })}
              >
                <Typography
                  variant='h6'
                  fontWeight='bold'
                  sx={(theme) => ({ pt: 0.2, color: alpha(theme.palette.primary.main, 0.75) })}
                  fontSize={13}
                >
                  {writeTone(lyricToShow)}
                </Typography>
              </Box>

              <IconButton
                aria-label='incrementar tom'
                size='small'
                onClick={() => { changeOffSet(true); }}
              >
                <AddIcon sx={(theme) => ({ color: alpha(theme.palette.primary.main, 0.65) })} fontSize='inherit' />
              </IconButton>
            </Stack>

            {/* Botão/loader para salvar offset (single lyric) */}
            {isOneLyric && (offsetChanged ? (
              offsetIsUpdating ? (
                <Box position='absolute' sx={{ right: 34, bottom: 35 }}>
                  <CircularProgress size={12} color='primary' />
                </Box>
              ) : (
                <IconButton
                  size='small'
                  sx={{ position: 'absolute', right: 27, bottom: 28, color: 'primary.main' }}
                  onClick={() => updateOffset()}
                >
                  <ThemedTooltip title='Salvar novo tom' placement='top'>
                    <SaveAsIcon fontSize='inherit' />
                  </ThemedTooltip>
                </IconButton>
              )
            ) : null)}

            {/* Botão/loader para salvar offset (lista) */}
            {!isOneLyric && (offsetsUpdateds.offsetChanged ? (
              offsetIsUpdating ? (
                <Box position='absolute' sx={{ right: 34, bottom: 35 }}>
                  <CircularProgress size={12} color='primary' />
                </Box>
              ) : (
                <IconButton
                  size='small'
                  sx={{ position: 'absolute', right: 27, bottom: 20, color: 'primary.main' }}
                  onClick={() => updateOffset()}
                >
                  <ThemedTooltip title='Salvar novo tom' placement='top'>
                    <SaveAsIcon fontSize='inherit' />
                  </ThemedTooltip>
                </IconButton>
              )
            ) : null)}
          </Badge>
        </Stack>

        <Markup content={htmlLyric} />
      </Box>
    );
  }

  function SecondColumn() {
    if (!htmlLyricSecond) return NextMusic();
    return (
      <Box display='inline'>
        <Markup content={htmlLyricSecond} />
        {lengthSecondColumn < 20 ? NextMusic() : null}
      </Box>
    );
  }

  function ThirdColumn() {
    if (!htmlLyricThird && lengthSecondColumn >= 20) return NextMusic();
    return htmlLyricThird ? (
      <Box display='inline'>
        <Markup content={htmlLyricThird} />
        {NextMusic()}
      </Box>
    ) : null;
  }

  function NextMusic() {
    if (!htmlLyricNextMusic) return null;
    return (
      <Box
        onClick={() => handleNext()}
        display='inline'
        sx={(theme) => ({
          cursor: 'pointer',
          color: theme.palette.text.secondary,
          '&:hover': { color: theme.palette.text.primary },
        })}
      >
        <Typography variant='h6' color='inherit'>
          {nextLyricToShow.lyricName}{' '}
          <Box component='span' fontSize={14} color='inherit'>
            ({nextLyricToShow.composerName})
          </Box>
        </Typography>
        <Markup content={htmlLyricNextMusic} />
      </Box>
    );
  }

  function NextMusicFloatButton() {
    return (
      <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
        <Tooltip title='Próxima música'>
          <Fab color='primary' aria-label='next' onClick={() => handleNext()}>
            <NextPlanIcon />
          </Fab>
        </Tooltip>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          fontSize: '14px',
          lineHeight: '15px',
          columnGap: 1.5,
          fontFamily: 'monospace',
          color: 'text.primary',
        }}
      >
        {FirstColumn()}
        {SecondColumn()}
        {ThirdColumn()}

        <Box>
          <Tooltip title='Editar música'>
            <IconButton
              aria-label='edit'
              onClick={() => router.push(`/lyric/manage-lyric/${lyricToShow.lyricId}`)}
              color='inherit'
            >
              <EditIcon color='primary' />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {htmlLyricNextMusic && NextMusicFloatButton()}
    </>
  );
};
