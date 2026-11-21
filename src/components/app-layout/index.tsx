import React, { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar from '@mui/material/AppBar';
import Tooltip from '@mui/material/Tooltip';
import Slide from '@mui/material/Slide';
import { useHideOnScroll } from '../../hooks/useHideOnScroll';
import { AppBarHiddenContext } from './AppBarVisibility';
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
import { InstantSearch } from 'react-instantsearch';
import { searchClient, ALGOLIA_LYRICS_INDEX } from '../../lib/algolia';
import { SideBarComponent } from './sidebar/Sidebar';
import { BrandWordmark } from './BrandWordmark';
import { AppBootSkeleton } from './AppBootSkeleton';

const MOBILE_DRAWER_WIDTH = 260;

export const Layout = ({ children, activeMenu }: any) => {
  const theme = useTheme();
  // Todo o app é renderizado só no cliente (ThemeModeProvider espera hidratar),
  // então dá para ler o media query de forma síncrona e evitar "piscar" o layout desktop.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [mobileOpen, setMobileOpen] = useState(false);
  // true ao rolar para baixo (passado o limite), false ao rolar para cima
  const appBarHidden = useHideOnScroll({ enabled: isMobile && !mobileOpen });

  const { profileConfigs, changeSidebar, ready } = useStorageProfileConfigs();

  if (!ready) return <AppBootSkeleton />

  const search = (
    <InstantSearch searchClient={searchClient} indexName={ALGOLIA_LYRICS_INDEX}>
      <SearchBarWithPopper />
    </InstantSearch>
  );

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
        <Slide appear={false} direction="down" in={!appBarHidden}>
        <MuiAppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ gap: 0.5, px: { xs: 1, sm: 2 } }}>
            <IconButton
              color="inherit"
              aria-label="abrir menu"
              onClick={() => setMobileOpen(true)}
              edge="start"
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ flex: 1, minWidth: 0 }}>{search}</Box>

            <ShowTimer compact />
            <NavbarComponent compact />
          </Toolbar>
        </MuiAppBar>
        </Slide>

        <MuiDrawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: MOBILE_DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          <DrawerHeader sx={{ justifyContent: 'space-between' }}>
            <BrandWordmark compact={false} />
            <IconButton onClick={() => setMobileOpen(false)} aria-label="fechar menu">
              <ChevronLeftIcon />
            </IconButton>
          </DrawerHeader>
          <Divider />
          <Box onClick={() => setMobileOpen(false)}>
            <SideBarComponent open activeMenu={activeMenu} />
          </Box>
        </MuiDrawer>

        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          <DrawerHeader />
          <AppBarHiddenContext.Provider value={appBarHidden}>
            <Box>{children}</Box>
          </AppBarHiddenContext.Provider>
        </Box>
      </Box>
    );
  }

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

          {search}

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

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <DrawerHeader />
        <Box>{children}</Box>
      </Box>
    </Box>
  );
};

const FullScreenButton = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(document.fullscreenElement != null);
    handleFullScreenChange();
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
    <Tooltip title={isFullScreen ? 'Sair da tela cheia' : 'Tela cheia'}>
      <Button
        variant="contained"
        color="primary"
        startIcon={isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        onClick={toggleFullScreen}
        sx={{ m: 1, whiteSpace: 'nowrap' }}
      >
        {isFullScreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
      </Button>
    </Tooltip>
  );
};
