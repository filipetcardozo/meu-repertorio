/* eslint-disable react-hooks/exhaustive-deps */
import SidebarComponent from './sidebar/Sidebar';
import NavbarComponent from './navbar/Navbar';
import React, { useEffect, useState } from 'react'
import { useTheme, } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Image from 'next/image'
import logo from '../../../public/EasyShowLogo.png'
import { DrawerHeader, AppBar, Drawer } from "./drawerConfig";
import { useStorageProfileConfigs } from '../../hooks/useStorageProfileConfigs';
import { Button } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

export const Layout = ({ children, activeMenu }: any) => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(true);

  const {
    changeSidebar,
    profileConfigs
  } = useStorageProfileConfigs()

  useEffect(() => {
    if (profileConfigs) {
      setOpen(profileConfigs.expandedSidebar)
    }
  }, [profileConfigs])

  const handleDrawerOpen = () => {
    changeSidebar(true)
    setOpen(true);
  };

  const handleDrawerClose = () => {
    changeSidebar(false)
    setOpen(false);
  };

  return <>
    <Box sx={{ display: 'flex' }}>
      {/* Navbar */}
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex' }}>
            <FullScreenButton />
            <NavbarComponent />
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <Image
            src={logo}
            alt="Logo Easy Show"
          />
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        {/* Navbar Component */}
        <SidebarComponent open={open} activeMenu={activeMenu} />
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1 }} >
        <DrawerHeader />
        <Box>
          {children}
        </Box>
      </Box>
    </Box >
  </>
}

const FullScreenButton = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleFullScreenChange = () => {
    setIsFullScreen(document.fullscreenElement != null);
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Failed to enter fullscreen mode: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
      onClick={toggleFullScreen}
      sx={{ margin: 1 }}
    >
      {isFullScreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
    </Button>
  );
};
