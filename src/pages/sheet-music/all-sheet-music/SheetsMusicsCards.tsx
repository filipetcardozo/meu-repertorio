import React from "react";
import Grid from '@mui/material/Grid'

// Hooks
import { useSheetsMusics } from "../../../hooks/useSheetsMusics";
import { SheetsMusicsCard } from "../../../components/sheet-music-card";

export const SheetsMusicsCards = () => {
    // States
    const { sheetsMusics } = useSheetsMusics()

    return <Grid sx={{ gap: 3 }} container justifyContent="flex-start" >
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