/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';

// Algolia
import TextField from '@mui/material/TextField'
import { Box, CircularProgress } from '@mui/material';
import { useSearchAlgolia } from '../../hooks/useSearchAlgolia';
import { CustomHits } from '../search-algolia/CustomHits';
import { Configure } from 'react-instantsearch-hooks-web';

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
      <Grid container mt={1} ml={1}>
        <Grid item
          pr={2}
          xs={10}
          sm={6}
          lg={4}
          xl={3}
        >
          <TextField
            fullWidth
            label="Qual música você quer tocar?"
            type="text"
            helperText={<>Você pode digitar qualquer parte, nome ou gênero da música.<br /><b>Divirta-se!</b></>}
            autoComplete="off"
            value={valueToSearch}
            onChange={(event) => {
              setValueToSearch(event.target.value)
              setUpdatingSearch(true)
            }}
          />
        </Grid>
        <Grid item ml={2} pt={2}>
          {
            updatingSearch ?
              <CircularProgress size={20} />
              : <></>
          }
        </Grid>
      </Grid>
      <Grid container justifyContent="start">
        <CustomHits hits={hits} />
      </Grid>
      <Grid item xs={12}>
        <Grid container justifyContent="start">
          <Pagination count={numberOfPages} shape="rounded" sx={{ color: "#ffffff" }} onChange={handleChangePage} />
        </Grid>
      </Grid>
    </>
  )
}