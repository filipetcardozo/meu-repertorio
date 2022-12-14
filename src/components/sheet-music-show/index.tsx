import { useEffect } from "react";
import React from 'react';

import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import Typography from '@mui/material/Typography';
import StepButton from '@mui/material/StepButton';
import { getAuth } from "firebase/auth";
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

export const SheetMusicShow = ({ sheetMusicId }: { sheetMusicId: any }) => {
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

    const RenderStepper = (value: any, index: number) => {
        return (
            <Step key={index} completed={completed[index]} >
                <StepButton
                    onClick={() => handleStep(index)}
                    sx={{
                        fontSize: "2px", position: "relative",
                        '& .MuiStepLabel-root .Mui-completed': {
                            color: "#5999d9", // circle color (COMPLETED)
                        },
                        '& .MuiStepLabel-root .Mui-active': {
                            color: "#007efa", // circle color (ACTIVE)
                        }
                    }}
                >
                    <Typography variant="h6" fontWeight="bold" fontSize={12}>
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

    // Temporary skeleton
    if (!readyToRender) {
        return <SkeletonComponent />
    }

    let heightScreen = window.innerHeight - 160

    return (
        <>
            <Box display="flex">
                <Box sx={{ minWidth: 200, maxWidth: 250, ml: 2, mt: 1, mr: 2 }}>
                    <Box display="flex" alignItems="center" >
                        {/* <LibraryMusicIcon style={{ fontSize: 15 }} /> */}
                        <Typography variant="h5" fontSize={15} color="#252849" fontWeight="bold">{sheetMusicToShow.sheetMusicName}</Typography>
                        <IconButton
                            // onClick={() => setRedirectChangeSheetMusic(value.id || "")}
                            onClick={() => {
                                // console.log(params.id)
                                router.push(`/sheet-music/manage-sheet-music/${sheetMusicId}`)
                            }}
                            size="small"
                        >
                            <LightTooltip title="Alterar repert??rio" placement="top">
                                <OpenInNewIcon style={{ fontSize: 13, color: "#252849" }} />
                            </LightTooltip>
                        </IconButton>
                    </Box>
                    <Typography variant="h6" fontSize={12} color="#00000054">{sheetMusicToShow.description}</Typography>
                    <Divider sx={{ width: "90%", pt: 0.3, mb: 1, borderColor: "#bdbdbdb0" }} />
                    <Stepper nonLinear activeStep={activeStep} orientation="vertical" sx={{ height: heightScreen, overflowY: "auto", overflowX: "hidden" }} >
                        {
                            !(sheetMusicToShow.lyrics.length > 0) ? "" :
                                sheetMusicToShow.lyrics.map((value: any, index: number) => (
                                    RenderStepper(value, index)
                                ))
                        }
                    </Stepper>
                </Box>

                <Box px={3} py={2} sx={{ mt: 2, backgroundColor: "#1976d212", borderRadius: 1.4, boxShadow: 2 }}>
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
                    N??vel de tocabilidade atualizado!
                </Alert>
            </Snackbar>
        </>
    )
}