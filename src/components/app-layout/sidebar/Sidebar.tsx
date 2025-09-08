import * as React from 'react';
import Link from 'next/link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import LyricsIcon from '@mui/icons-material/Lyrics';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { alpha } from '@mui/material/styles';

type SideBarProps = { open: boolean; activeMenu?: number };

const NAV_ITEMS = [
  { key: 'inicio', label: 'Início', href: '/', icon: <HomeIcon /> },
  { key: 'show-sheets-musics', label: 'Repertórios cadastrados', href: '/sheet-music/all-sheet-music', icon: <LyricsIcon /> },
  { key: 'create-sheet-music', label: 'Criar repertório', href: '/sheet-music/manage-sheet-music', icon: <HistoryEduIcon /> },
  { key: 'adicionar-cifras', label: 'Adicionar Cifras', href: '/lyric/manage-lyric', icon: <PlaylistAddIcon /> },
];

export const SideBarComponent: React.FC<SideBarProps> = ({ open, activeMenu }) => {
  return (
    <List sx={{ p: 0 }}>
      {NAV_ITEMS.map((item, idx) => {
        const selected = activeMenu === idx;
        return (
          <ListItem key={item.key} disablePadding sx={{ display: 'block' }}>
            {/* Use o ListItemButton como link direto (sem <Link> externo) */}
            <ListItemButton
              component={Link}
              href={item.href}
              selected={selected}
              sx={(theme) => ({
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,

                // Cores 100% baseadas no tema:
                // Deixe o default (theme.palette.action.selected) ou
                // use um tinte da cor primária:
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity),
                },
                '&.Mui-selected:hover': {
                  backgroundColor: alpha(
                    theme.palette.primary.main,
                    theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity
                  ),
                },
              })}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 1.5 : 'auto',
                  justifyContent: 'center',
                  color: 'inherit', // herda do tema
                }}
              >
                {item.icon}
              </ListItemIcon>

              <ListItemText
                primary={<Typography fontSize={15} color="inherit">{item.label}</Typography>}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};
