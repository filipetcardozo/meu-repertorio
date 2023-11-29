import React from 'react';
import Grid from '@mui/material/Grid'
import { useSheetsMusics } from '../../hooks/useSheetsMusics';
import { SheetsMusicsCard } from '.';

export const SheetsMusicsCards = () => {
  const { sheetsMusics, setSheetsMusics } = useSheetsMusics()

  return <Grid sx={{ gap: 3 }} container justifyContent='center' >
    {
      sheetsMusics.map((value: any, index) => {
        return (
          <Grid item key={index}>
            <SheetsMusicsCard sheetMusic={value} sheetsMusics={sheetsMusics} setSheetsMusics={setSheetsMusics} index={index} />
          </Grid>
        )
      })
    }
  </Grid>
}