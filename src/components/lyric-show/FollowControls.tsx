import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { alpha, keyframes } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded';
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import type { HighlightBox } from '../../hooks/useLyricFollow';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.45); }
  70% { box-shadow: 0 0 0 9px rgba(211, 47, 47, 0); }
  100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
`;

type Props = {
  playing: boolean;
  onTogglePlay: () => void;
  speedLabel: string;
  onFaster: () => void;
  onSlower: () => void;
  voice: {
    supported: boolean;
    enabled: boolean;
    listening: boolean;
    error: string | null;
    heard: string;
    toggle: () => void;
  };
  hasCurrentLine: boolean;
  tuner: {
    supported: boolean;
    enabled: boolean;
    error: string | null;
    toggle: () => void;
  };
  /** Painel do afinador (aparece acima da barrinha quando ligado). */
  tunerPanel?: React.ReactNode;
  /** Distância do rodapé (ex.: para não cobrir outro botão flutuante). */
  bottomOffset?: number;
};

/** Barrinha flutuante: rolagem automática (play/pausa + velocidade) e seguir a voz. */
export function FollowControls({
  playing, onTogglePlay, speedLabel, onFaster, onSlower, voice, hasCurrentLine, tuner, tunerPanel, bottomOffset = 16,
}: Props) {
  let caption: React.ReactNode = null;
  const errorMsg = voice.error ?? tuner.error;
  if (errorMsg) {
    caption = <Box component="span" sx={{ color: "error.main" }}>{errorMsg}</Box>;
  } else if (voice.enabled && !voice.listening) {
    caption = 'Ligando o microfone…';
  } else if (voice.enabled && voice.heard) {
    caption = <>“{voice.heard}”</>;
  } else if (voice.enabled) {
    caption = hasCurrentLine ? 'Ouvindo…' : 'Pode cantar — ou toque na linha onde vai começar';
  }

  const micTitle = !voice.supported
    ? 'Seu navegador não reconhece voz (use Chrome, Edge ou Safari)'
    : voice.enabled ? 'Parar de seguir a voz' : 'Seguir a voz: destaca a linha cantada';

  return (
    <Box
      data-follow-controls
      sx={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
        zIndex: 'speedDial',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      {tuner.enabled && tunerPanel}

      {caption && (
        <Paper
          elevation={3}
          role='status'
          aria-live='polite'
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            maxWidth: 300,
            pointerEvents: 'auto',
          }}
        >
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{caption}</Typography>
        </Paper>
      )}

      <Paper
        elevation={6}
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: 999,
          px: 0.5,
          py: 0.25,
          pointerEvents: 'auto',
        }}
      >
        <Tooltip title={playing ? 'Pausar rolagem' : 'Rolagem automática'}>
          <IconButton
            aria-label={playing ? 'pausar rolagem automática' : 'iniciar rolagem automática'}
            onClick={onTogglePlay}
            color={playing ? 'primary' : 'default'}
          >
            {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
          </IconButton>
        </Tooltip>

        {playing && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton size='small' aria-label='rolar mais devagar' onClick={onSlower}>
              <RemoveRoundedIcon fontSize='small' />
            </IconButton>
            <Tooltip title={voice.enabled ? 'Velocidade (a voz ajusta sozinha)' : 'Velocidade'}>
              <Typography
                aria-live='polite'
                sx={{ fontSize: 13, fontWeight: 600, minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
              >
                {speedLabel}
              </Typography>
            </Tooltip>
            <IconButton size='small' aria-label='rolar mais rápido' onClick={onFaster}>
              <AddRoundedIcon fontSize='small' />
            </IconButton>
          </Box>
        )}

        <Divider orientation='vertical' flexItem sx={{ mx: 0.5, my: 1 }} />

        <Tooltip title={micTitle}>
          <span>
            <IconButton
              aria-label={voice.enabled ? 'parar de seguir a voz' : 'seguir a voz'}
              aria-pressed={voice.enabled}
              onClick={voice.toggle}
              disabled={!voice.supported}
              sx={[
                voice.enabled && ((t) => ({
                  color: t.palette.error.main,
                  backgroundColor: alpha(t.palette.error.main, 0.1),
                  '&:hover': { backgroundColor: alpha(t.palette.error.main, 0.16) },
                })),
                voice.listening && { animation: `${pulse} 1.8s infinite` },
              ]}
            >
              {voice.enabled ? <MicRoundedIcon /> : <MicNoneRoundedIcon />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={!tuner.supported ? 'Seu navegador não permite usar o microfone aqui' : tuner.enabled ? 'Fechar afinador' : 'Afinador: mostra se você está afinado e em que tom canta'}>
          <span>
            <IconButton
              aria-label={tuner.enabled ? 'fechar afinador' : 'abrir afinador'}
              aria-pressed={tuner.enabled}
              onClick={tuner.toggle}
              disabled={!tuner.supported}
              color={tuner.enabled ? 'primary' : 'default'}
              sx={tuner.enabled ? (t) => ({ backgroundColor: alpha(t.palette.primary.main, 0.12) }) : undefined}
            >
              <GraphicEqRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Box>
  );
}

/** Faixa que marca a linha que está sendo cantada (fica por cima do texto, sem bloquear cliques). */
export function CurrentLineHighlight({ box }: { box: HighlightBox | null }) {
  if (!box) return null;
  return (
    <Box
      aria-hidden
      sx={(t) => ({
        position: 'absolute',
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        borderRadius: 1,
        pointerEvents: 'none',
        backgroundColor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.2 : 0.12),
        borderLeft: `3px solid ${t.palette.primary.main}`,
        transition: 'top 220ms ease, height 220ms ease, left 220ms ease, width 220ms ease',
      })}
    />
  );
}
