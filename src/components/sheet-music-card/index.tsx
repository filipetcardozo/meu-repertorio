import { useEffect, useState } from "react"

import React, { useMemo } from "react";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid'
import LyricsIcon from '@mui/icons-material/Lyrics';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import Chip from '@mui/material/Chip';
import PersonIcon from '@mui/icons-material/Person';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CardHeader from '@mui/material/CardHeader';
import Avatar from '@mui/material/Avatar';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FiEdit } from 'react-icons/fi';
import Link from "next/link";
import { SheetsMusicsCards } from "../../pages/sheet-music/all-sheet-music/SheetsMusicsCards";
import { useRouter } from "next/router";

export const SheetsMusicsCard = ({ sheetMusic, index }: { sheetMusic: any, index: any }) => {
    const router = useRouter()

    // States
    function renderComposers(composers: any) {
        let composersFiltered: any = []
        composers.lyrics.map((value: any) => {
            let filtering = composersFiltered.filter((v: any) => v.composerName == value.composerName)
            if (filtering.length == 0) composersFiltered.push(value)
        })

        return composersFiltered;
    }

    // Redirect to change sheet music
    // const [redirectChangeSheetMusic, setRedirectChangeSheetMusic] = useState("")
    // if (redirectChangeSheetMusic != "") <Navigate to={"/sheets-musics/" + redirectChangeSheetMusic} replace />;


    if (!sheetMusic) return <></>;

    return <Card sx={{ boxShadow: 3, width: "300px", height: "400px" }}>
        <CardHeader
            avatar={
                <Avatar sx={{ bgcolor: "primary.light", width: 30, height: 30, fontSize: 17 }} aria-label="recipe">
                    {index + 1}
                </Avatar>
            }
            action={
                <IconButton
                    // onClick={() => setRedirectChangeSheetMusic(value.id || "")}
                    onClick={() => {
                        router.push(`/sheet-music/manage-sheet-music/${sheetMusic.id}`)
                    }}
                    size="small"
                >
                    <FiEdit style={{ fontSize: 13 }} />
                </IconButton>
            }
            title={sheetMusic.sheetMusicName}
        // subheader="September 14, 2016"
        />
        <CardContent>
            {/* <Typography variant="h6" fontSize={17} fontWeight="bold" textAlign="center" mb={1} component="div">
                                    {value.sheetMusicName}
                                </Typography> */}
            <Typography sx={{ fontSize: 13 }} color="text.secondary">
                {sheetMusic.description}
            </Typography>
            <Typography sx={{ my: 2, display: "flex", alignItems: "center", gap: 1 }} variant="body2" color="text.secondary">
                <LyricsIcon sx={{ color: "#6ab5ff" }} /> <strong>{sheetMusic.lyrics.length} </strong> músicas adicionas
            </Typography>
            <Typography sx={{ my: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }} variant="body2" color="text.secondary">
                <AccessTimeIcon sx={{ color: "#6ab5ff" }} /> Aproximadamente <strong>{sheetMusic.lyrics.length * 4} minutos</strong>
            </Typography>
            <Typography sx={{ mb: 0.5, mt: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }} variant="body2" color="text.secondary">
                <GroupsIcon sx={{ color: "#6ab5ff" }} /> Entre os artistas estão:<br />
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center" style={{ overflowX: "auto" }} height="110px">
                {
                    renderComposers(sheetMusic).map((v: any, index: any) => {
                        return <Chip key={index} icon={<PersonIcon />} size="small" label={v.composerName} />
                    })
                }
            </Box>
        </CardContent>

        <CardActions>
            <Link style={{ textDecoration: "none" }} href={`/sheet-music/show-sheet-music/${sheetMusic.id}`} >
                <Button sx={{ fontWeight: "bold" }} size="small" startIcon={<PlayCircleOutlineIcon sx={{ position: "relative", bottom: 1.3, left: 3 }} />}>Iniciar Show</Button>
            </Link>
        </CardActions>
    </Card>
}