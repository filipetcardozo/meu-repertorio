import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import AccountCircle from '@mui/icons-material/AccountCircle';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useAuth } from '../../../hooks/useAuth';
import Stack from '@mui/material/Stack';
import { ThemeToggleIconButton } from '../ThemeToggleMenuItem';
import { useThemeMode } from '../../../theme/ThemeModeProvider';
import { useState } from 'react';

type NavbarProps = {
  /** No mobile o botão de tema vai para dentro do menu da conta para economizar espaço. */
  compact?: boolean;
};

export const NavbarComponent = ({ compact = false }: NavbarProps) => {
  const { signOut } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      {/* Agrupe os botões do lado direito do AppBar */}
      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
        {!compact && <ThemeToggleIconButton />}
        <IconButton
          size={compact ? 'medium' : 'large'}
          edge={compact ? 'end' : false}
          aria-label="abrir menu da conta"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          onClick={handleMenu}
          color="inherit"
        >
          <AccountCircle />
        </IconButton>
      </Stack>

      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        keepMounted
      >
        {compact && (
          <MenuItem
            onClick={() => {
              handleClose();
              toggleMode();
            }}
          >
            <ListItemIcon>
              {isDark ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </ListItemIcon>
            {isDark ? 'Tema claro' : 'Tema escuro'}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleClose();
            signOut();
          }}
        >
          Sair
        </MenuItem>
      </Menu>
    </>
  );
};
