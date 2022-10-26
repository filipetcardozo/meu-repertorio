/* eslint-disable react-hooks/exhaustive-deps */
import React from "react"
import { Markup } from 'interweave';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography'
import NextPlanIcon from '@mui/icons-material/NextPlan';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Stack from "@mui/material/Stack"
import Badge from '@mui/material/Badge';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import { useLyricShow } from "../../hooks/useLyricShow";
import { writeTone } from "../../utils/writeTone";
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/router'

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

    const router = useRouter()
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
    })

    function FirstColumn() {
        if (htmlLyric) return <Box display="inline" className="lyric-show">
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                <Typography variant="h6" fontSize={15}>
                    {lyricToShow.lyricName + " "}
                    <Box component="span" fontSize={11}>
                        ({lyricToShow.composerName})
                    </Box>
                </Typography>
                <Badge color="info"
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: lyricToShow.offset > 0 ? "right" : "left",
                    }}
                    badgeContent={offsetLyricToShow > 0 ? "+" + offsetLyricToShow : offsetLyricToShow}>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0}
                        sx={{
                            border: "1px solid #1976d24a",
                            borderRadius: 3
                        }}>
                        <IconButton aria-label="delete" size="small" onClick={() => { changeOffSet(false) }}>
                            <RemoveIcon sx={{ color: "#1976d2a1" }} fontSize="inherit" />
                        </IconButton>
                        <Box display="flex" alignItems="center" justifyContent="center" style={{ width: "25px", height: "25px", color: "#1976d2" }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ pt: 0.2 }} fontSize={13} color="#1976d2a1">
                                {writeTone(lyricToShow)}
                            </Typography>
                        </Box>
                        <IconButton aria-label="delete" size="small" onClick={() => { changeOffSet(true) }}>
                            <AddIcon sx={{ color: "#1976d2a1" }} fontSize="inherit" />
                        </IconButton>
                    </Stack>
                    {
                        isOneLyric ?
                            offsetChanged ?
                                offsetIsUpdating ?
                                    <CircularProgress
                                        size={12}
                                        sx={{
                                            color: "primary",
                                            position: "absolute", right: 34, bottom: 35,

                                        }}
                                    />
                                    :
                                    <IconButton size="small" className="blob"
                                        sx={{
                                            color: "#1976d2", position: "absolute", right: 27, bottom: 28,
                                        }}
                                        onClick={() => updateOffset()}
                                    >
                                        <LightTooltip title="Salvar novo tom" placement="top">
                                            <SaveAsIcon fontSize="inherit" />
                                        </LightTooltip>
                                    </IconButton>
                                :
                                <></>
                            : <></>
                    }

                    {
                        !isOneLyric ?
                            offsetsUpdateds.offsetChanged ?
                                offsetIsUpdating ?
                                    <CircularProgress
                                        size={12}
                                        sx={{
                                            color: "primary",
                                            position: "absolute", right: 34, bottom: 35,

                                        }}
                                    />
                                    :
                                    <IconButton size="small" className="blob"
                                        sx={{
                                            color: "#1976d2", position: "absolute", right: 27, bottom: 28,
                                        }}
                                        onClick={() => updateOffset()}
                                    >
                                        <LightTooltip title="Salvar novo tom" placement="top">
                                            <SaveAsIcon fontSize="inherit" />
                                        </LightTooltip>
                                    </IconButton>
                                :
                                <></> :
                            <></>
                    }
                </Badge>
            </Stack>


            {/* <Typography variant="h6" fontSize={16} mt={0.3} color="primary">C</Typography>
                    <IconButton size="small" color="primary">
                        <MdExpandLess />
                    </IconButton> */}

            <Markup content={htmlLyric} />
        </Box >
    }

    function SecondColumn() {
        if (!htmlLyricSecond) return NextMusic();

        if (htmlLyricSecond) return <Box display="inline">
            <Markup content={htmlLyricSecond} />
            {lengthSecondColumn < 20 ? NextMusic() : ""}
        </Box>
    }

    function ThirdColumn() {
        if (!htmlLyricThird && lengthSecondColumn >= 20) return NextMusic();

        if (htmlLyricThird) return <Box display="inline">
            <Markup content={htmlLyricThird} />
            {NextMusic()}
        </Box>
    }

    function NextMusic() {
        if (htmlLyricNextMusic) return <Box display="inline" color="#00000066">
            <Box justifyContent="center" >
                <Box textAlign="center">
                    <Fab size="small" onClick={() => handleNext()} variant="extended">
                        <NextPlanIcon sx={{ mr: 1 }} />
                        Próxima música
                    </Fab>
                </Box>
            </Box>

            <Typography variant="h6">{nextLyricToShow.lyricName} <Box component="span" fontSize={14}> ({nextLyricToShow.composerName})</Box></Typography>
            <Markup content={htmlLyricNextMusic} />
        </Box>
    }

    return <>
        {/* <Button variant="outlined" onClick={() => setHabiliteSolo(!habiliteSolo)}>
            Mostrar solosx={{ px: 3, py: 2, backgroundColor: "#1976d212", borderRadius: 1.4, boxShadow: 2 }}
        </Button> */}
        <Box sx={{
            display: "flex", fontSize: "14px", lineHeight: "15px", gap: 4, fontFamily: "monospace"
        }}>
            {FirstColumn()}
            {SecondColumn()}
            {ThirdColumn()}
            <Box>
                <Tooltip title="Editar música">
                    <IconButton aria-label="edit" onClick={(() => router.push(`/lyric/manage-lyric/${lyricToShow.lyricId}`))}>
                        <EditIcon color="primary" />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box >
    </>
}