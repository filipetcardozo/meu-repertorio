import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useThemeMode } from '../../theme/ThemeModeProvider';

export const ThemeToggleIconButton: React.FC = () => {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'Tema claro' : 'Tema escuro'}>
      <IconButton
        aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        color="inherit"
        onClick={toggleMode}
        edge="end"
      >
        {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
};
