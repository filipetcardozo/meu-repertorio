/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';

// Algolia
import TextField from '@mui/material/TextField'
import { Box, CircularProgress } from '@mui/material';
import { useSearchAlgolia } from '../../hooks/useSearchAlgolia';
import { CustomHits } from '../search-algolia/CustomHits';
import { Configure } from 'react-instantsearch';
import { PageHero, getGreeting } from '../app-layout/PageHero';

export const HomeLyrics = () => {
  const {
    hits,
    page,
    valueToSearch,
    updatingSearch,
    numberOfPages,
    setValueToSearch,
    handleChangePage,
    setUpdatingSearch
  } = useSearchAlgolia()

  return (
    <>
      <Configure
        hitsPerPage={20}
        page={page}
      />
      <Box sx={{ pt: { xs: 1, sm: 2 }, px: 1 }}>
        <PageHero title={`${getGreeting()}!`} subtitle='Qual música você quer tocar hoje?' />
      </Box>
      <Grid sx={{ ml: 1 }} container>
        <Grid sx={{ pr: 2, mb: 2 }} size={{ xs: 10, sm: 6, lg: 4, xl: 3 }}
        >
          <TextField
            fullWidth
            label="Buscar música ou artista"
            type="text"
            autoComplete="off"
            value={valueToSearch}
            onChange={(event) => {
              setValueToSearch(event.target.value)
              setUpdatingSearch(true)
            }}
          />
        </Grid>
        <Grid sx={{ ml: 2, pt: 2 }}>
          {
            updatingSearch ?
              <CircularProgress size={20} />
              : <></>
          }
        </Grid>
      </Grid>
      <Grid sx={{ justifyContent: 'start' }} container>
        <CustomHits hits={hits} />
      </Grid>
      <Grid size={12}>
        <Grid sx={{ justifyContent: 'start' }} container>
          <Pagination count={numberOfPages} shape="rounded" color="primary" onChange={handleChangePage} />
        </Grid>
      </Grid>
    </>
  )
}