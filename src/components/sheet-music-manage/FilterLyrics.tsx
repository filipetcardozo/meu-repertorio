/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Avatar from '@mui/material/Avatar';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

// Algolia
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, useHits, useSearchBox } from 'react-instantsearch-hooks-web';
import type { lyricInSheetMusicType } from '../../types/sheetMusicType';

const searchClient = algoliasearch('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');

type Props = {
  handlePushMusicToSheets: (v: lyricInSheetMusicType, index: number) => void;
  lyricsToAdd: lyricInSheetMusicType[];
};

export const FilterLyrics: React.FC<Props> = ({ handlePushMusicToSheets, lyricsToAdd }) => {
  function CustomHits() {
    const { hits } = useHits();

    if (!hits?.length) return null;

    return (
      <>
        {hits.map((value: any, index: number) => {
          const isSelected = lyricsToAdd.some((v) => v.lyricId === value.objectID);

          return (
            <Grid key={value.objectID ?? index} item xl={3} lg={4} xs={12} sm={6} sx={{ p: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  const newValue: lyricInSheetMusicType = {
                    composerId: value.composerId,
                    composerName: value.composerName,
                    lyricId: value.objectID,
                    lyricName: value.lyricName,
                    lyricStyle: value.lyricStyle,
                    originalTone: 'A'
                  };
                  handlePushMusicToSheets(newValue, index);
                }}
                sx={(theme) => ({
                  p: 2,
                  borderRadius: 2,
                  alignItems: 'flex-start',
                  // fundo adaptado ao tema + estado selecionado
                  backgroundColor: alpha(
                    theme.palette.primary.main,
                    isSelected
                      ? (theme.palette.mode === 'dark' ? 0.20 : 0.14)
                      : (theme.palette.mode === 'dark' ? 0.12 : 0.08)
                  ),
                  border: `1px solid ${alpha(
                    theme.palette.primary.main,
                    isSelected
                      ? (theme.palette.mode === 'dark' ? 0.30 : 0.22)
                      : (theme.palette.mode === 'dark' ? 0.24 : 0.16)
                  )}`,
                  transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
                    duration: theme.transitions.duration.shortest,
                  }),
                  '&:hover': {
                    backgroundColor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === 'dark' ? 0.22 : 0.16
                    ),
                    boxShadow: theme.shadows[2],
                  },
                })}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={(theme) => ({
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.30 : 0.18
                      ),
                      color: theme.palette.primary.contrastText,
                      fontWeight: 600,
                      width: 32,
                      height: 32,
                      fontSize: 14,
                    })}
                  >
                    {index + 1}
                  </Avatar>
                </ListItemAvatar>

                <ListItemText
                  primary={value.lyricName}
                  secondary={value.composerName}
                  primaryTypographyProps={{
                    variant: 'subtitle1',
                    color: 'text.primary',
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                  secondaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                    noWrap: true,
                  }}
                  sx={{ mr: 5 }}
                />

                {/* “Check” à direita quando já está na lista */}
                {isSelected && (
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                    <PlaylistAddCheckIcon color="success" fontSize="small" />
                  </Box>
                )}
              </ListItemButton>
            </Grid>
          );
        })}
      </>
    );
  }

  function CustomSearchBox() {
    const { refine } = useSearchBox();
    const [valueToSearch, setValueToSearch] = React.useState('');
    const [updatingSearch, setUpdatingSearch] = React.useState(false);

    React.useEffect(() => {
      const timer = setTimeout(() => {
        refine(valueToSearch);
        setUpdatingSearch(false);
      }, 600);
      return () => clearTimeout(timer);
    }, [valueToSearch]);

    return (
      <Grid item xs={12} mt={2}>
        <TextField
          fullWidth
          size="small"
          variant="filled"
          label="Procurar música..."
          value={valueToSearch}
          onChange={(e) => {
            setValueToSearch(e.target.value);
            setUpdatingSearch(true);
          }}
          InputProps={{
            endAdornment: updatingSearch ? <CircularProgress size={18} sx={{ mr: 0.5 }} /> : null,
          }}
        />
      </Grid>
    );
  }

  return (
    <List dense sx={{ p: 0 }}>
      <Grid container spacing={1}>
        <InstantSearch searchClient={searchClient} indexName="lyrics">
          <CustomSearchBox />
          <CustomHits />
        </InstantSearch>
      </Grid>
    </List>
  );
};
