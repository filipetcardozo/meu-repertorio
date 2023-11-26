import { createRef, useEffect, useLayoutEffect, useRef } from "react";
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
import { styled } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton';
import { useShowSheetMusic } from "../../hooks/useShowSheetMusic";
import { SkeletonComponent } from "./Skeleton";
import { LyricShowComponent } from "../lyric-show";
import { useRouter } from "next/dist/client/router";
import { useLyricShow } from "../../hooks/useLyricShow";
import { lyricInSheetMusicType } from "../../types/sheetMusicType";

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  props,
  ref,
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.common.white,
    color: 'rgba(0, 0, 0, 0.87)',
    boxShadow: theme.shadows[1],
    fontSize: 11,
  },
}));

export const SheetMusicShow = ({ sheetMusicId }: { sheetMusicId: string }) => {
  const router = useRouter()
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
    setSheetMusicToShow
  } = useShowSheetMusic({ sheetMusicId })

  const stepRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);

  useEffect(() => {
    if (sheetMusicToShow && sheetMusicToShow.lyrics) {
      stepRefs.current = sheetMusicToShow.lyrics.map((_, i) => stepRefs.current[i] || createRef());
    }
  }, [sheetMusicToShow?.lyrics]);

  useLayoutEffect(() => {
    if (activeStep < stepRefs.current.length && stepRefs.current[activeStep].current) {
      const stepElement = stepRefs.current[activeStep].current;
      if (stepElement) {
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  }, [activeStep]);

  const RenderStepper = (value: lyricInSheetMusicType, index: number) => {
    let isStepperActive = activeStep === index;
    return (
      <Step key={value.lyricId} completed={completed[index]} ref={stepRefs.current[index]}>
        <StepButton
          onClick={() => handleStep(index)}
          sx={{
            fontSize: "2px",
            position: "relative",
            '& .MuiStepLabel-root .Mui-completed': {
              color: "#5999d9",
            },
            '& .MuiStepLabel-root .Mui-active': {
              color: "#0055a9",
            },
          }}
        >
          <Typography variant="h6" fontWeight="bold" fontSize={isStepperActive ? 14 : 12} color={isStepperActive ? "primary" : "inherit"}>
            {value.lyricName}
          </Typography>
          <Typography fontSize={10} sx={{ color: "#00000054" }}>{value.composerName}</Typography>
          <Box position="absolute" display="flex">
            <Rating sx={{ fontSize: 12 }} name="size-small" size="small"
              value={
                displacementStart && activeStep == index ? startValueInLoading : value.stars
              }
              onChange={(event, newValue) => {
                updateStars(newValue)
              }}
              readOnly={updatingStarsLoading || displacementStart}
            />
            {
              updatingStarsLoading && activeStep == index ? <Box position="relative">
                <CircularProgress
                  size={9}
                  sx={{
                    color: "primary",
                    position: "absolute", left: 5, top: 1.5
                  }}
                />
              </Box> : ""
            }
          </Box>
        </StepButton>
      </Step>
    )
  }

  useEffect(() => {
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  });

  const RenderLyric = () => {
    if (!lyricToShow || !sheetMusicToShow) return <></>;

    return <LyricShowComponent
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

  }

  let heightScreen = window.innerHeight - 160

  // Temporary skeleton
  if (!readyToRender) {
    return <SkeletonComponent />
  }


  if (!lyricToShow || !sheetMusicToShow) return <></>;

  return (
    <>
      <Box display="flex">
        <Box sx={{ minWidth: 200, maxWidth: 250, ml: 2, mt: 1, mr: 2 }}>
          <Box display="flex" alignItems="center" >
            <Typography variant="h5" fontSize={15} color="#252849" fontWeight="bold">{sheetMusicToShow.sheetMusicName}</Typography>
            <IconButton
              onClick={() => {
                router.push(`/sheet-music/manage-sheet-music/${sheetMusicId}`)
              }}
              size="small"
            >
              <LightTooltip title="Alterar repertório" placement="top">
                <OpenInNewIcon style={{ fontSize: 13, color: "#252849" }} />
              </LightTooltip>
            </IconButton>
          </Box>
          <Typography variant="h6" fontSize={12} color="#00000054">{sheetMusicToShow.description}</Typography>
          <Divider sx={{ width: "90%", pt: 0.3, mb: 1, borderColor: "#bdbdbdb0" }} />
          <Box sx={{
            height: heightScreen, overflowY: "auto", overflowX: "hidden",
            '&::-webkit-scrollbar': {
              width: '4px' // Largura da barra de rolagem
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1' // Cor de fundo da track da barra de rolagem
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888', // Cor da barra de rolagem
              borderRadius: '2px', // Raio da borda da barra de rolagem
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555', // Cor da barra de rolagem ao passar o mouse
            },
          }}>
            <Stepper nonLinear activeStep={activeStep} orientation="vertical" sx={{ maxHeight: heightScreen }} >
              {
                !(sheetMusicToShow.lyrics.length > 0) ? "" :
                  sheetMusicToShow.lyrics.map((value: any, index: number) => (
                    RenderStepper(value, index)
                  ))
              }
            </Stepper>
          </Box>
        </Box>

        <Box
          sx={{
            backgroundColor: "#1976d212", borderRadius: 1.4, boxShadow: 2, px: 2, pt: 2, pb: 0,
            maxHeight: heightScreen + 60, overflowY: "auto", overflowX: "hidden"
          }}
        >
          <RenderLyric />
        </Box>
      </Box>
      <Snackbar open={openUpdatedSuccess} autoHideDuration={6000} onClose={handleCloseUpdatedSuccess}>
        <Alert onClose={handleCloseUpdatedSuccess} severity="success" sx={{ width: '100%' }}>
          Tom atualizado!
        </Alert>
      </Snackbar>

      <Snackbar open={openUpdatedStarsSuccess} autoHideDuration={6000} onClose={handleCloseUpdatedSuccess}>
        <Alert onClose={handleCloseUpdatedSuccess} severity="success" sx={{ width: '100%' }}>
          Nível de tocabilidade atualizado!
        </Alert>
      </Snackbar>
    </>
  )
}