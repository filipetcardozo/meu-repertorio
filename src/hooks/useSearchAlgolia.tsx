/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo } from 'react';

// Algolia
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, SearchBox, Hits, useHits } from 'react-instantsearch-hooks-web';
import TextField from '@mui/material/TextField'
import { useSearchBox, UseSearchBoxProps, Configure } from 'react-instantsearch-hooks-web';
import LinearProgress from '@mui/material/LinearProgress';
import { AppProps } from 'next/app';
import { Box, CircularProgress, Stack } from '@mui/material';


export const useSearchAlgolia = () => {
    const [valueToSearch, setValueToSearch] = useState("")
    const { refine } = useSearchBox();
    const { hits, results } = useHits();
    const [page, setPage] = useState(0);
    const [updatingSearch, setUpdatingSearch] = useState(false)

    const numberOfPages = useMemo(() => {
        return results?.nbPages
    }, [results])

    useEffect(() => {
        const timer = setTimeout(() => {
            refine(valueToSearch)
            setUpdatingSearch(false)
        }, 500);

        return () => clearTimeout(timer);
    }, [valueToSearch])

    const handleChangePage = (event: any, value: any) => {
        setPage(value - 1);
    };

    return {
        hits,
        page,
        valueToSearch,
        updatingSearch,
        numberOfPages,
        setValueToSearch,
        handleChangePage,
        setUpdatingSearch
    }
}