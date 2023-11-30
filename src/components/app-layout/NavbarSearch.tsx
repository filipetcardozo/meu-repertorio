import React, { useState } from 'react';
import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import { useSearchAlgolia } from '../../hooks/useSearchAlgolia';
import { Grid, IconButton, Typography } from '@mui/material';
import { CustomHitsNavbarSearch } from '../search-algolia/CustomHitsNavbarSearch';
import { SearchAppBar } from '../Search';
import CloseIcon from '@mui/icons-material/Close';

export const SearchBarWithPopper = () => {
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);

  const {
    hits,
    valueToSearch,
    setValueToSearch,
    setUpdatingSearch
  } = useSearchAlgolia()


  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValueToSearch(event.target.value);
    setUpdatingSearch(true);
    setAnchorEl(event.currentTarget);
  };

  return (
    <>
      <SearchAppBar value={valueToSearch} onChange={handleInputChange}
        setAnchorEl={setAnchorEl}
      />
      <Popper
        open={Boolean(anchorEl) || valueToSearch.length > 0}
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{ width: 600, maxHeight: 500, zIndex: 2000, position: 'relative' }}
      >
        <IconButton
          sx={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }}
          onClick={() => { setAnchorEl(null); }}>
          <CloseIcon />
        </IconButton>
        <Paper>
          <Grid container justifyContent="start" padding={1}>
            <CustomHitsNavbarSearch hits={hits} closePopper={() => { setAnchorEl(null); setValueToSearch('') }} />
          </Grid>
          {
            hits.length === 0 && <Typography sx={{ p: 3 }}>
              <span style={{ opacity: 0.8 }}>Ops... não encontramos nenhuma música.</span> 🙁
            </Typography>
          }
        </Paper>
      </Popper>
    </>
  );
};