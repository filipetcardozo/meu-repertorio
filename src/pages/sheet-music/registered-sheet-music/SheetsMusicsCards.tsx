import React from "react";
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

// Components
import { Layout } from "../../../components/app-layout";

// Hooks
import { useSheetsMusics } from "../../../hooks/useSheetsMusics";
import { SheetsMusicsCard } from "../../../components/sheet-music-card";
import { useAuth, useProtectPage } from "../../../hooks/useAuth";

export const SheetsMusicsCards = () => {
    // States
    const { sheetsMusics } = useSheetsMusics()

    return <Grid container spacing={5} justifyContent="space-evenly">
        {
            sheetsMusics.map((value: any, index) => {
                return (
                    <Grid item key={index}>
                        <SheetsMusicsCard sheetMusic={value} index={index} />
                    </Grid>
                )
            })
        }
    </Grid>
}