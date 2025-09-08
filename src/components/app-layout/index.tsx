/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { DrawerHeader, AppBar, Drawer } from './drawerConfig';
import { useStorageProfileConfigs } from '../../hooks/useStorageProfileConfigs';
import { Button } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { NavbarComponent } from './navbar/Navbar';
import { ShowTimer } from './ShowTimer';
import { SearchBarWithPopper } from './NavbarSearch';
import algoliasearch from 'algoliasearch';
import { InstantSearch } from 'react-instantsearch-hooks-web';
import { SideBarComponent } from './sidebar/Sidebar';
import { BrandWordmark } from './BrandWordmark'; // <— corrigido o nome
import { AppBootSkeleton } from './AppBootSkeleton';

export const Layout = ({ children, activeMenu }: any) => {
  const searchClient = algoliasearch('M91WDCEXS4', '0fa682d5b69e7040b462c96daecbb0fd');
  const theme = useTheme();

  const { profileConfigs, changeSidebar, ready } = useStorageProfileConfigs();

  if (!ready) return <AppBootSkeleton />

  const open = !!profileConfigs?.expandedSidebar;

  const handleDrawerOpen = () => changeSidebar(true);
  const handleDrawerClose = () => changeSidebar(false);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>

          <InstantSearch searchClient={searchClient} indexName="lyrics">
            <SearchBarWithPopper />
          </InstantSearch>

          <ShowTimer />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex' }}>
            <FullScreenButton />
            <NavbarComponent />
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <BrandWordmark compact={!open} />
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <SideBarComponent open={open} activeMenu={activeMenu} />
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1 }}>
        <DrawerHeader />
        <Box>{children}</Box>
      </Box>
    </Box>
  );
};

const FullScreenButton = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleFullScreenChange = () => setIsFullScreen(document.fullscreenElement != null);

  useEffect(() => {
    if (document.fullscreenElement) setIsFullScreen(true);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Failed to enter fullscreen mode: ${e.message}`);
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
      onClick={toggleFullScreen}
      sx={{ m: 1, whiteSpace: 'nowrap' }}
    >
      {isFullScreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
    </Button>
  );
};
