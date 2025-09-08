import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { useAuth } from '../../../hooks/useAuth';
import Stack from '@mui/material/Stack';
import { ThemeToggleIconButton } from '../ThemeToggleMenuItem';
import { useState } from 'react';

export const NavbarComponent = () => {
  const { signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      {/* Agrupe os botões do lado direito do AppBar */}
      <Stack direction="row" spacing={1} alignItems="center">
        <ThemeToggleIconButton />
        <IconButton
          size="large"
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
