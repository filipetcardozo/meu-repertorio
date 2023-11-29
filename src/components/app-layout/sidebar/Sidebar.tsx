import * as React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import HomeIcon from '@mui/icons-material/Home';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import LyricsIcon from '@mui/icons-material/Lyrics';
import Typography from '@mui/material/Typography'
import Link from 'next/link'
import { useAuth } from '../../../hooks/useAuth';

const SideBarComponent = ({ open, activeMenu }: { open: boolean, activeMenu: number | undefined }) => {
  return (
    <>
      <List sx={{ p: 0 }}>
        <ListItem key="inicio" style={{ textDecoration: "none", color: "inherit" }} disablePadding sx={{ display: 'block', backgroundColor: activeMenu == 0 ? "#e4f1ff" : "" }}>
          <Link href="/">
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 1.5 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <HomeIcon />
              </ListItemIcon>
              <ListItemText primary={<Typography fontSize={15}>Início</Typography>} sx={{ textDecoration: "none", opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </Link>
        </ListItem>
        <ListItem key="show-sheets-musics" style={{ textDecoration: "none", color: "inherit" }} disablePadding sx={{ display: 'block', backgroundColor: activeMenu == 1 ? "#e4f1ff" : "" }}>
          <Link href={"/sheet-music/all-sheet-music"}>
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 1.5 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <LyricsIcon />
              </ListItemIcon>
              <ListItemText primary={<Typography fontSize={15}>Repertórios cadastrados</Typography>} sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </Link>
        </ListItem>
        <ListItem key="create-sheet-music" style={{ textDecoration: "none", color: "inherit" }} disablePadding sx={{ display: 'block', backgroundColor: activeMenu == 2 ? "#e4f1ff" : "" }}>
          <Link href={"/sheet-music/manage-sheet-music"}>
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 1.5 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <HistoryEduIcon />
              </ListItemIcon>
              <ListItemText primary={<Typography fontSize={15}>Criar repertório</Typography>} sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </Link>
        </ListItem>
        <Link href={"/lyric/manage-lyric"}>
          <ListItem key="adicionar-cifras" style={{ textDecoration: "none", color: "inherit" }} disablePadding sx={{ display: 'block', backgroundColor: activeMenu == 4 ? "#e4f1ff" : "" }}>
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 1.5 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <PlaylistAddIcon />
              </ListItemIcon>
              <ListItemText primary={<Typography fontSize={15}>Adicionar Cifras</Typography>} sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        </Link>
      </List>
    </>
  )
}

export default SideBarComponent;