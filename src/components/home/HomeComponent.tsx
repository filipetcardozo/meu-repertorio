/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo } from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Grid from '@mui/material/Grid';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Pagination from '@mui/material/Pagination';

// Algolia
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, SearchBox, Hits, useHits } from 'react-instantsearch-hooks-web';
import TextField from '@mui/material/TextField'
import { useSearchBox, UseSearchBoxProps, Configure } from 'react-instantsearch-hooks-web';
import LinearProgress from '@mui/material/LinearProgress';
import { AppProps } from 'next/app';
import { Box, CircularProgress, Stack } from '@mui/material';
import { useSearchAlgolia } from '../../hooks/useSearchAlgolia';
import { CustomHits } from '../search-algolia/CustomHits';

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