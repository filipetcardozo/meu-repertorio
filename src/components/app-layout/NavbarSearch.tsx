import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import { Grid, IconButton, Typography } from '@mui/material';
import { useSearchAlgolia } from '../../hooks/useSearchAlgolia';
import { CustomHitsNavbarSearch } from '../search-algolia/CustomHitsNavbarSearch';
import { SearchAppBar } from '../Search';
import CloseIcon from '@mui/icons-material/Close';

export const SearchBarWithPopper = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const { hits, valueToSearch, setValueToSearch, setUpdatingSearch } = useSearchAlgolia();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValueToSearch(event.target.value);
    setUpdatingSearch(true);
    setAnchorEl(event.currentTarget);
  };

  const handleClear = () => {
    setValueToSearch('');
  };

  const open = Boolean(anchorEl) && valueToSearch.length > 0;

  return (
    <>
      <SearchAppBar
        value={valueToSearch}
        onChange={handleInputChange}
        onClear={handleClear}
        setAnchorEl={setAnchorEl}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableScrollLock
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        keepMounted
        slotProps={{ paper: {
          sx: {
            width: { xs: 'calc(100vw - 16px)', sm: 600 },
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: { xs: '70dvh', sm: 500 },
            overflowY: 'auto',
            position: 'relative',
            zIndex: 2000,
          },
        } }}
      >
        <IconButton
          sx={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }}
          onClick={() => setAnchorEl(null)}
        >
          <CloseIcon />
        </IconButton>

        <Paper sx={{ width: 1, boxShadow: 'none' }}>
          <Grid sx={{ justifyContent: 'start', padding: 1 }} container>
            <CustomHitsNavbarSearch
              hits={hits}
              closePopper={() => {
                setAnchorEl(null);
                setValueToSearch('');
              }}
            />
          </Grid>

          {hits.length === 0 && (
            <Typography sx={{ p: 3 }}>
              <span style={{ opacity: 0.8 }}>Ops... não encontramos nenhuma música.</span> 🙁
            </Typography>
          )}
        </Paper>
      </Popover>
    </>
  );
};
