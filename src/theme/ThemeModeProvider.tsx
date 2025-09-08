import { PaletteMode, ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from './createAppTheme';
import { createContext, useCallback, useMemo, useState, useEffect, useContext } from 'react';

type ThemeMode = Extract<PaletteMode, 'light' | 'dark'>;
type SetMode = (next: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => void;

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: SetMode;
  toggleMode: () => void;
};

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

const STORAGE_KEY = 'theme-mode';

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark') return saved;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export const ThemeModeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(getInitialMode());
    setHydrated(true);
  }, []);

  const setMode = useCallback<SetMode>((next) => {
    setModeState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: ThemeMode) => ThemeMode)(prev) : next;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, resolved);
      }
      return resolved;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, [setMode]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  if (!hydrated) return null;

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = (): ThemeModeContextValue => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
};
