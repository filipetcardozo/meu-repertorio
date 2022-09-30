// Sidebar and Navbar
import SidebarComponent from './sidebar/Sidebar';
import NavbarComponent from './navbar/Navbar';

// Image
import logo from "../../../../Images/EasyShowLogo.png"

import * as React from 'react';
import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { openedMixin, closedMixin, DrawerHeader, AppBar, Drawer } from "./drawerConfig";


export const Layout = ({ children, activeMenu }: any) => {
    const theme = useTheme();
    const [open, setOpen] = React.useState(true);

    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };

    return <>
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            {/* Navbar */}
            <AppBar position="fixed" open={open}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{
                            marginRight: 5,
                            ...(open && { display: 'none' }),
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                    {/* Navbar Component  */}
                    <NavbarComponent />
                </Toolbar>
            </AppBar>
            <Drawer variant="permanent" open={open}>
                <DrawerHeader>
                    <Box sx={{ maxWidth: "160px", "&:hover": { cursor: "pointer" } }}>
                        {/* <img style={{ width: 160 }} src={logo} alt="Logo Easy Show" /> */}
                    </Box>
                    {/* <Box component={"img"} src="EasyShowLogo.png" alt="" sx={{ maxWidth: "160px" }} /> */}
                    <IconButton onClick={handleDrawerClose}>
                        {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                </DrawerHeader>
                <Divider />
                {/* Navbar Component */}
                <SidebarComponent open={open} activeMenu={activeMenu} />
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1 }}>
                <DrawerHeader />
                <Box sx={{ p: 0 }}>
                    {children}
                </Box>
            </Box>
        </Box >
    </>
}