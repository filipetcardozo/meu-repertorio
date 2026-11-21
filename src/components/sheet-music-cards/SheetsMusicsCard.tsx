import React from "react";
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import LyricsOutlinedIcon from '@mui/icons-material/LyricsOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import { alpha } from '@mui/material/styles';
import { FiEdit } from 'react-icons/fi';
import Link from "next/link";
import { useRouter } from "next/router";
import { sheetMusicType } from "../../types/sheetMusicType";
import { useStorageSheetMusic } from "../../hooks/useStorageSheetMusic";
import { useSnackbar } from "notistack";
import { displayFontFamily } from "../../theme/createAppTheme";

// Faixas do "ingresso". Todas são tons escuros o bastante para o texto branco passar no contraste AA.
const TICKET_GRADIENTS = [
  ['#C026D3', '#7C3AED'],
  ['#7C3AED', '#4F46E5'],
  ['#DB2777', '#C026D3'],
  ['#A21CAF', '#4F46E5'],
  ['#BE185D', '#7C3AED'],
];

const ticketGradient = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const [from, to] = TICKET_GRADIENTS[Math.abs(hash) % TICKET_GRADIENTS.length];
  return `linear-gradient(120deg, ${from} 0%, ${to} 100%)`;
};

// Estimativa simples: ~4 minutos por música.
const formatDuration = (songs: number) => {
  const minutes = songs * 4;
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h ${m}min` : `~${h}h`;
};

export const SheetsMusicsCard = ({ sheetMusic, setSheetsMusics, sheetsMusics, index }: { sheetMusic: sheetMusicType, setSheetsMusics: any, sheetsMusics: any, index: any }) => {
  const router = useRouter()
  const { enqueueSnackbar } = useSnackbar();
  const { callDeleteCompletedSheetMusicLocalStorage } = useStorageSheetMusic()

  function cleanCompleted() {
    callDeleteCompletedSheetMusicLocalStorage(sheetMusic.id!)
    setSheetsMusics(sheetsMusics.map((s: sheetMusicType, i: number) => (i === index ? { ...s, completed: undefined } : s)))
    enqueueSnackbar("O histórico da partitura foi limpado!", { variant: "success" })
  }

  if (!sheetMusic) return <></>;

  const songs = sheetMusic.lyrics.length;

  return <Card
    sx={(theme) => ({
      width: { xs: '100%', sm: 300 },
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.04) : 'background.paper',
      transition: theme.transitions.create(['transform', 'box-shadow']),
      '&:hover': { boxShadow: theme.brand.glow, transform: 'translateY(-2px)' },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
    })}
  >
    {/* Faixa do ingresso */}
    <Box sx={{ position: 'relative', height: 96, px: 2, py: 1.5, color: '#fff', backgroundImage: ticketGradient(sheetMusic.id ?? sheetMusic.sheetMusicName), display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component='span' sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', opacity: 0.9 }}>
          #{String(index + 1).padStart(2, '0')}
        </Typography>
        <Tooltip title='Editar repertório'>
          <IconButton
            aria-label='Editar repertório'
            size='small'
            onClick={() => router.push(`/sheet-music/manage-sheet-music/${sheetMusic.id}`)}
            sx={{ color: 'inherit', backgroundColor: alpha('#000', 0.18), '&:hover': { backgroundColor: alpha('#000', 0.3) } }}
          >
            <FiEdit style={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography
        component='h2'
        title={sheetMusic.sheetMusicName}
        sx={{
          mt: 'auto',
          fontFamily: displayFontFamily,
          fontWeight: 600,
          fontSize: 18,
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {sheetMusic.sheetMusicName}
      </Typography>
    </Box>

    {/* Picote do ingresso */}
    <Box
      aria-hidden
      sx={(theme) => ({
        position: 'relative',
        borderTop: `2px dashed ${theme.palette.divider}`,
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          top: -9,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: theme.palette.background.default,
          border: `1px solid ${theme.palette.divider}`,
        },
        '&::before': { left: -9 },
        '&::after': { right: -9 },
      })}
    />

    <Box sx={{ px: 2, pt: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
      {sheetMusic.description && (
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 13,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {sheetMusic.description}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        <Chip size='small' variant='outlined' icon={<LyricsOutlinedIcon />} label={`${songs} ${songs === 1 ? 'música' : 'músicas'}`} />
        <Chip size='small' variant='outlined' icon={<AccessTimeIcon />} label={formatDuration(songs)} />
        {sheetMusic.completed ? (
          <Tooltip title='Músicas já tocadas neste show. Clique para zerar.'>
            <Chip
              size='small'
              color='primary'
              variant='outlined'
              icon={<CheckCircleOutlineIcon />}
              label={`${sheetMusic.completed}/${songs} tocadas`}
              onClick={cleanCompleted}
            />
          </Tooltip>
        ) : null}
      </Box>

      <Button
        component={Link}
        href={`/sheet-music/show-sheet-music/${sheetMusic.id}`}
        variant='contained'
        startIcon={<PlayArrowRoundedIcon />}
        sx={{ mt: 'auto', alignSelf: 'flex-start' }}
      >
        Iniciar show
      </Button>
    </Box>
  </Card>
}
