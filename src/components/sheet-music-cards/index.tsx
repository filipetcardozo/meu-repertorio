import React from 'react';
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import Link from 'next/link';
import { useSheetsMusics } from '../../hooks/useSheetsMusics';
import { SheetsMusicsCard } from './SheetsMusicsCard';
import { PageHero } from '../app-layout/PageHero';

const NEW_SHEET_MUSIC_HREF = '/sheet-music/manage-sheet-music';

export const SheetsMusicsCards = () => {
  const { sheetsMusics, setSheetsMusics, loaded } = useSheetsMusics()

  const newButton = (
    <Button component={Link} href={NEW_SHEET_MUSIC_HREF} variant='outlined' startIcon={<AddRoundedIcon />}>
      Novo repertório
    </Button>
  );

  return <>
    <PageHero title='Seus repertórios' subtitle='Qual show vai rolar hoje?' action={sheetsMusics.length > 0 ? newButton : undefined} />

    {!loaded ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    ) : sheetsMusics.length === 0 ? (
      <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
        <Typography variant='h6' component='h2'>Monte seu primeiro repertório</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
          Junte as músicas do show na ordem que vai tocar e abra tudo com um clique no palco.
        </Typography>
        <Button component={Link} href={NEW_SHEET_MUSIC_HREF} variant='contained' startIcon={<AddRoundedIcon />}>
          Criar repertório
        </Button>
      </Box>
    ) : (
      <Grid sx={{ justifyContent: { xs: 'center', sm: 'flex-start' } }} container spacing={2.5}>
        {
          sheetsMusics.map((value, index) => (
            <Grid key={value.id ?? index} size={{ xs: 12, sm: 'auto' }}>
              <SheetsMusicsCard sheetMusic={value} sheetsMusics={sheetsMusics} setSheetsMusics={setSheetsMusics} index={index} />
            </Grid>
          ))
        }
      </Grid>
    )}
  </>
}
