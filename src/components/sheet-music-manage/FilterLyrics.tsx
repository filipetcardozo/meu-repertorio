/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import Grid from '@mui/material/Grid'
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField'

// Algolia
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, useHits } from 'react-instantsearch-hooks-web';
import { useSearchBox } from 'react-instantsearch-hooks-web';
import { lyricInSheetMusicType } from '../../types/sheetMusicType';

const searchClient = algoliasearch('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');

export const FilterLyrics = ({
  handlePushMusicToSheets, lyricsToAdd
}: { handlePushMusicToSheets: any, lyricsToAdd: lyricInSheetMusicType[] }) => {

  function CustomHits() {
    const { hits } = useHits();

    return <>
      {
        hits.length > 0 ? hits.map((value: any, index: number) => {
          return <Grid key={index} item xl={3} lg={4} xs={6}>
            <ListItem
              onClick={() => {
                let newValue = {
                  composerId: value.composerId,
                  composerName: value.composerName,
                  lyricId: value.objectID,
                  lyricName: value.lyricName,
                  lyricStyle: value.lyricStyle,
                  originalTone: "A"
                }
                handlePushMusicToSheets(newValue, index)
              }}
              key={index}
              sx={{
                padding: 2, backgroundColor: `${lyricsToAdd.filter((values: lyricInSheetMusicType) => values.lyricId == value.objectID).length > 0 ? "#dff0ff" : "#eaf0f5"}`, borderRadius: 2,
                '&:hover': {
                  cursor: "pointer",
                  backgroundColor: "#d5ebff"
                },
              }}

              secondaryAction={
                lyricsToAdd.filter((values: any) => values.lyricId == value.objectID).length > 0 ? <PlaylistAddCheckIcon fontSize="small" /> : null
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
    const { refine, } = useSearchBox();

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

  return <List dense={true}>
    <Grid container spacing={2}>
      <InstantSearch searchClient={searchClient} indexName="lyrics">
        <CustomSearchBox />
        <CustomHits />
      </InstantSearch>
    </Grid>
  </List>
}