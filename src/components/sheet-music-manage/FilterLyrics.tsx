import React, { useCallback, useEffect, useState } from 'react';
import Grid from '@mui/material/Grid'
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import ListSubheader from '@mui/material/ListSubheader';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField'

// Algolia
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, useHits } from 'react-instantsearch-hooks-web';
import { useSearchBox } from 'react-instantsearch-hooks-web';


const searchClient = algoliasearch('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');

export const FilterLyrics = (params: any) => {

    const lyrics = params.lyrics
    const handlePushMusicToSheets = params.handlePushMusicToSheets
    const lyricsToAdd: any[] = params.lyricsToAdd

    const filteredValue = params.filteredValue
    const setFilteredValue = params.setFilteredValue
    const sheetsMusics = params.sheetsMusics

    function CustomHits() {
        const { hits, results, sendEvent } = useHits();
        // console.log(hits)
        return <>
            {
                hits.length > 0 ? hits.map((value: any, index: number) => {
                    return <Grid key={index} item xs={6}>
                        <ListItem
                            button
                            onClick={() => {
                                let newValue = {
                                    composerId: value.composerId,
                                    composerName: value.composerName,
                                    lyricId: value.objectID,
                                    lyricName: value.lyricName,
                                    lyricStyle: value.lyricStyle,
                                    originalTone: "A"
                                }
                                console.log(newValue)

                                handlePushMusicToSheets(newValue, index)
                            }}
                            key={index}
                            sx={{
                                padding: 2, backgroundColor: `${lyricsToAdd.filter((values) => values.lyricId == value.objectID).length > 0 ? "#dff0ff" : "#eaf0f5"}`, borderRadius: 2,
                                '&:hover': {
                                    // boxShadow: 1,
                                    cursor: "pointer",
                                    backgroundColor: "#d5ebff"
                                },
                            }}

                            secondaryAction={
                                lyricsToAdd.filter((values) => values.lyricId == value.objectID).length > 0 ? <PlaylistAddCheckIcon fontSize="small" /> : null
                            }
                        >
                            <ListItemAvatar>
                                <Avatar>
                                    {index + 1}
                                </Avatar>
                            </ListItemAvatar>

                            <ListItemText
                                primary={value.lyricName}
                                secondary={value.composerName}
                            />
                        </ListItem>
                    </Grid>
                }) : <></>
            }
        </>
    }

    function CustomSearchBox() {
        const { query, refine, clear, isSearchStalled } = useSearchBox();

        const [valueToSearch, setValueToSearch] = React.useState("")

        const [updatingSearch, setUpdatingSearch] = React.useState(false)

        useEffect(() => {
            const timer = setTimeout(() => {
                refine(valueToSearch)
                setUpdatingSearch(false)
            }, 1000);

            return () => clearTimeout(timer);
        }, [valueToSearch])

        return <Grid item xs={12} mt={2} display="flex" alignItems="center" justifyContent="center">
            <Grid container spacing={2} textAlign="center">
                <Grid item xs={12}>
                    <TextField
                        size="small"
                        variant="filled"
                        label="Procurar música..."
                        type="text"
                        //   value={}
                        onChange={(event) => {
                            setValueToSearch(event.target.value)
                            setUpdatingSearch(true)
                        }}
                    />
                </Grid>
                {
                    updatingSearch ? <Grid item xs={12}>
                        <CircularProgress size={26} />
                    </Grid> : <></>
                }

            </Grid>
        </Grid>

    }

    return <>
        <FormControl variant="filled" fullWidth>
            <InputLabel id="demo-simple-select-filled-label">Filtro</InputLabel>
            <Select
                labelId="demo-simple-select-filled-label"
                id="demo-simple-select-filled"
                margin="none"
                defaultValue="Todas as músicas"
                onChange={(event) => setFilteredValue(event.target.value)}
            >
                <ListSubheader>Mais utilizados</ListSubheader>
                <MenuItem value={"Todas as músicas"}>Todas as músicas</MenuItem>
                <MenuItem value={"Todas as músicas cadastradas"}>Todas as músicas cadastradas</MenuItem>

                <ListSubheader>Filtrar por partitura</ListSubheader>
                {
                    sheetsMusics.length > 0 ? sheetsMusics.map((value: any, index: number) => {
                        return <MenuItem key={index} value={"Partitura: " + value.sheetMusicName}>{value.sheetMusicName}</MenuItem>
                    }) : <MenuItem disabled>Ainda não foi cadastrada nenhuma partitura</MenuItem>
                }

                <ListSubheader>Filtrar por gênero musical</ListSubheader>
                <MenuItem value={"Gênero: Sertanejo"}>Sertanejo</MenuItem>
                <MenuItem value={"Gênero: Samba"}>Samba</MenuItem>
                <MenuItem value={"Gênero: Pagode"}>Pagode</MenuItem>
                <MenuItem value={"Gênero: Rock"}>Rock</MenuItem>
                <MenuItem value={"Gênero: Gospel/Religioso"}>Gospel/Religioso</MenuItem>
            </Select>
        </FormControl>
        <List dense={true}>
            <Grid container spacing={2}>
                <InstantSearch searchClient={searchClient} indexName="lyrics">
                    <CustomSearchBox />
                    <CustomHits />
                </InstantSearch>
            </Grid>
        </List>
    </>
}