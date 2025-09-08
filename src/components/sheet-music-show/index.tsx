import { createRef, useEffect, useLayoutEffect, useRef } from 'react';
import React from 'react';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import Typography from '@mui/material/Typography';
import StepButton from '@mui/material/StepButton';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton';
import { useShowSheetMusic } from '../../hooks/useShowSheetMusic';
import { SkeletonComponent } from './Skeleton';
import { LyricShowComponent } from '../lyric-show';
import { useRouter } from 'next/dist/client/router';
import { lyricInSheetMusicType } from '../../types/sheetMusicType';

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  props,
  ref,
) {
  return <MuiAlert elevation={6} ref={ref} variant='filled' {...props} />;
});

// Tooltip que respeita o tema
const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[1],
    fontSize: 11,
  },
}));

export const SheetMusicShow = ({ sheetMusicId }: { sheetMusicId: string }) => {
  const router = useRouter();
  const {
    activeStep,
    completed,
    lyricToShow,
    readyToRender,
    sheetMusicToShow,
    handleNext,
    handleStep,
    downHandler,
    changeOffSet,
    openUpdatedSuccess,
    openUpdatedStarsSuccess,
    updateStars,
    updateOffset,
    startValueInLoading,
    displacementStart,
    updatingStarsLoading,
    offsetsUpdateds,
    offsetIsUpdating,
    handleCloseUpdatedSuccess,
  } = useShowSheetMusic({ sheetMusicId });

  const stepRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);

  useEffect(() => {
    if (sheetMusicToShow && sheetMusicToShow.lyrics) {
      stepRefs.current = sheetMusicToShow.lyrics.map((_, i) => stepRefs.current[i] || createRef());
    }
  }, [sheetMusicToShow?.lyrics]);

  useLayoutEffect(() => {
    if (activeStep < stepRefs.current.length && stepRefs.current[activeStep].current) {
      const stepElement = stepRefs.current[activeStep].current;
      stepElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeStep]);

  const RenderStepper = (value: lyricInSheetMusicType, index: number) => {
    const isStepperActive = activeStep === index;
    return (
      <Step key={value.lyricId} completed={completed[index]} ref={stepRefs.current[index]}>
        <StepButton
          onClick={() => handleStep(index)}
          sx={(theme) => ({
            fontSize: '2px',
            position: 'relative',
            // cores de estado do StepLabel
            '& .MuiStepLabel-root .Mui-completed': {
              color: theme.palette.primary.light,
            },
            '& .MuiStepLabel-root .Mui-active': {
              color: theme.palette.primary.main,
            },
          })}
        >
          <Typography
            variant='h6'
            fontWeight='bold'
            fontSize={isStepperActive ? 14 : 12}
            color={isStepperActive ? 'primary' : 'text.primary'}
          >
            {value.lyricName}
          </Typography>

          <Typography fontSize={10} sx={(theme) => ({ color: theme.palette.text.secondary })}>
            {value.composerName}
          </Typography>

          <Box position='absolute' display='flex'>
            <Rating
              sx={{ fontSize: 12 }}
              name='size-small'
              size='small'
              value={displacementStart && activeStep === index ? startValueInLoading : value.stars}
              onChange={(_, newValue) => { updateStars(newValue); }}
              readOnly={updatingStarsLoading || displacementStart}
            />
            {updatingStarsLoading && activeStep === index ? (
              <Box position='relative'>
                <CircularProgress
                  size={9}
                  color='primary' // use a prop, não sx.color
                  sx={{ position: 'absolute', left: 5, top: 1.5 }}
                />
              </Box>
            ) : null}
          </Box>
        </StepButton>
      </Step>
    );
  };

  useEffect(() => {
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  });

  const RenderLyric = () => {
    if (!lyricToShow || !sheetMusicToShow) return null;

    return (
      <LyricShowComponent
        changeOffSet={changeOffSet}
        handleNext={handleNext}
        lyricToShow={lyricToShow}
        nextLyricToShow={sheetMusicToShow.lyrics[activeStep + 1]}
        offsetsUpdateds={offsetsUpdateds[activeStep]}
        updateOffset={updateOffset}
        offsetIsUpdating={offsetIsUpdating}
        offsetLyricToShow={lyricToShow.offset!}
        isOneLyric={false}
      />
    );
  };

  const heightScreen = typeof window !== 'undefined' ? window.innerHeight - 160 : 600;

  if (!readyToRender) return <SkeletonComponent />;
  if (!lyricToShow || !sheetMusicToShow) return null;

  return (
    <>
      <Box display='flex' mt={1}>
        <Box sx={{ minWidth: 200, maxWidth: 250, ml: 2, mt: 1, mr: 2 }}>
          <Box display='flex' alignItems='center'>
            <Typography
              variant='h5'
              fontSize={15}
              fontWeight='bold'
              color='text.primary'
            >
              {sheetMusicToShow.sheetMusicName}
            </Typography>

            <IconButton
              onClick={() => { router.push(`/sheet-music/manage-sheet-music/${sheetMusicId}`); }}
              size='small'
              color='inherit'
            >
              <LightTooltip title='Alterar repertório' placement='top'>
                <OpenInNewIcon sx={{ fontSize: 13 }} />
              </LightTooltip>
            </IconButton>
          </Box>

          <Typography variant='h6' fontSize={12} color='text.secondary'>
            {sheetMusicToShow.description}
          </Typography>

          <Divider sx={{ width: '90%', pt: 0.3, mb: 1 }} />

          <Box
            sx={(theme) => ({
              height: heightScreen,
              overflowY: 'auto',
              overflowX: 'hidden',
              // Scrollbar theme-aware
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-track': {
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.06)
                  : alpha(theme.palette.common.black, 0.06),
              },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.28)
                  : alpha(theme.palette.common.black, 0.28),
                borderRadius: 2,
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.4)
                  : alpha(theme.palette.common.black, 0.4),
              },
            })}
          >
            <Stepper nonLinear activeStep={activeStep} orientation='vertical' sx={{ maxHeight: heightScreen }}>
              {sheetMusicToShow.lyrics.length > 0 &&
                sheetMusicToShow.lyrics.map((value: any, index: number) => RenderStepper(value, index))}
            </Stepper>
          </Box>
        </Box>

        {/* Coluna direita (conteúdo) */}
        <Box
          sx={(theme) => ({
            backgroundColor: alpha(theme.palette.primary.main, 0.08), // era #1976d212
            borderRadius: 1.4,
            boxShadow: 2,
            px: 2,
            pt: 2,
            pb: 0,
            maxHeight: heightScreen + 60,
            overflowY: 'auto',
            overflowX: 'hidden',
          })}
        >
          <RenderLyric />
        </Box>
      </Box>

      {/* Snackbars usam a paleta do tema automaticamente via severity */}
      <Snackbar open={openUpdatedSuccess} autoHideDuration={6000} onClose={handleCloseUpdatedSuccess}>
        <Alert onClose={handleCloseUpdatedSuccess} severity='success' sx={{ width: '100%' }}>
          Tom atualizado!
        </Alert>
      </Snackbar>

      <Snackbar open={openUpdatedStarsSuccess} autoHideDuration={6000} onClose={handleCloseUpdatedSuccess}>
        <Alert onClose={handleCloseUpdatedSuccess} severity='success' sx={{ width: '100%' }}>
          Nível de tocabilidade atualizado!
        </Alert>
      </Snackbar>
    </>
  );
};
