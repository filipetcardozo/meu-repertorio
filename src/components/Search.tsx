import * as React from 'react';
import { styled, alpha } from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import IconButton from '@mui/material/IconButton';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ClearIconWrapper = styled('div')(({ theme }) => ({
  position: 'absolute',
  right: 4,
  top: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    paddingRight: theme.spacing(4), // espaço pro botão de limpar
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

interface SearchAppBarProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  setAnchorEl: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

export const SearchAppBar: React.FC<SearchAppBarProps> = ({ value, onChange, onClear, setAnchorEl }) => {
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  return (
    <Search>
      <SearchIconWrapper>
        <SearchIcon />
      </SearchIconWrapper>

      <StyledInputBase
        placeholder="Pesquisar música..."
        inputProps={{ 'aria-label': 'search' }}
        value={value}
        onChange={onChange}
        inputRef={inputRef}
        onFocus={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => setAnchorEl(e.currentTarget)}
      />

      {value.length > 0 && (
        <ClearIconWrapper>
          <IconButton
            size="small"
            // evita perder o foco ao clicar
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              // mantém foco no input
              inputRef.current?.focus();
              setAnchorEl(inputRef.current);
            }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        </ClearIconWrapper>
      )}
    </Search>
  );
};
