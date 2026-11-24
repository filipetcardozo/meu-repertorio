/**
 * Playback sincronizado no modo show:
 * - PlaybackButton: botão na barra de controles (abre o player, ou a janela de playbacks);
 * - PlaybackBar: player flutuante acima dos controles de rolagem;
 * - PlaybackManagerDialog: enviar mp3, renomear, re-sincronizar, apagar e escolher o playback.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Badge from '@mui/material/Badge';
import Alert from '@mui/material/Alert';
import { alpha } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import Replay5RoundedIcon from '@mui/icons-material/Replay5Rounded';
import Forward5RoundedIcon from '@mui/icons-material/Forward5Rounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { enqueueSnackbar } from 'notistack';
import type { PlaybackSync } from '../../hooks/usePlaybackSync';
import type { PlaybackType } from '../../types/playbackType';
import {
  MAX_PLAYBACK_BYTES, cifraHash, deletePlayback, renamePlayback, resyncPlayback, uploadPlayback,
} from '../../providers/playbacks/services';

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
/** Diferença de semitons no intervalo -6..+5. */
const wrapSemis = (n: number) => ((((n + 6) % 12) + 12) % 12) - 6;

function statusChip(p: PlaybackType) {
  switch (p.status) {
    case 'uploading': return <Chip size='small' label='Enviando' />;
    case 'processing': return <Chip size='small' color='info' label='Sincronizando' />;
    case 'error': return <Chip size='small' color='error' label='Erro' />;
    default: return <Chip size='small' color='success' variant='outlined' label='Pronto' />;
  }
}

// ---------------------------------------------------------------------------------------------
// Botão na barra de controles
// ---------------------------------------------------------------------------------------------

export function PlaybackButton({ sync, onManage, size }: {
  sync: PlaybackSync;
  onManage: () => void;
  size?: 'small' | 'medium';
}) {
  const has = !!sync.readyTrack;
  const title = has ? (sync.open ? 'Playback aberto' : 'Tocar com o playback') : 'Playbacks: tocar com o áudio da música, sincronizado';
  return (
    <Tooltip title={title}>
      <IconButton
        aria-label='playbacks'
        onClick={() => (has ? sync.setOpen(true) : onManage())}
        size={size}
        color={sync.open ? 'primary' : 'default'}
        sx={sync.open ? (t) => ({ backgroundColor: alpha(t.palette.primary.main, 0.12) }) : undefined}
      >
        <Badge color='primary' variant='dot' invisible={!has || sync.open}>
          <QueueMusicRoundedIcon fontSize={size === 'small' ? 'small' : 'medium'} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------------------------
// Player flutuante
// ---------------------------------------------------------------------------------------------

export function PlaybackBar({ sync, offset, onShiftKey, onManage }: {
  sync: PlaybackSync;
  /** Tom atual da cifra em relação ao original (semitons). */
  offset: number;
  onShiftKey?: (semitones: number) => void;
  onManage: () => void;
}) {
  const [menuEl, setMenuEl] = React.useState<HTMLElement | null>(null);
  const [rateEl, setRateEl] = React.useState<HTMLElement | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const t = sync.track;
  if (!sync.open || !t) return null;

  const ready = sync.readyTrack;
  const keyDiff = ready?.transpose != null ? wrapSemis(ready.transpose - offset) : 0;

  return (
    <Paper
      elevation={6}
      data-follow-controls
      sx={{
        pointerEvents: 'auto',
        width: 'min(520px, calc(100vw - 32px))',
        borderRadius: 3,
        px: 1.5,
        pt: 1,
        pb: 0.5,
      }}
    >
      <Stack direction='row' sx={{ alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Button
          size='small'
          color='inherit'
          onClick={(e) => setMenuEl(e.currentTarget)}
          endIcon={<ExpandMoreRoundedIcon />}
          sx={{ minWidth: 0, textTransform: 'none', fontWeight: 600, px: 1 }}
        >
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, maxWidth: 220 }}>{t.label}</Typography>
        </Button>
        {ready?.bpm ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{Math.round(ready.bpm)} BPM</Typography>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title='Fechar o player'>
          <IconButton size='small' aria-label='fechar o player' onClick={sync.close}>
            <CloseRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Stack>

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        {sync.tracks.map((p) => (
          <MenuItem
            key={p.id}
            selected={p.id === t.id}
            onClick={() => { setMenuEl(null); if (p.id) sync.pick(p.id); }}
          >
            <ListItemIcon>{p.id === t.id ? <CheckRoundedIcon fontSize='small' /> : null}</ListItemIcon>
            <ListItemText primary={p.label} secondary={p.status === 'ready' ? null : statusChip(p)} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setMenuEl(null); onManage(); }}>
          <ListItemIcon><TuneRoundedIcon fontSize='small' /></ListItemIcon>
          <ListItemText primary='Gerenciar playbacks' />
        </MenuItem>
      </Menu>

      {t.status === 'uploading' || t.status === 'processing' ? (
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
            {t.status === 'uploading' ? 'Enviando o áudio…' : 'Sincronizando com a cifra… (leva menos de um minuto)'}
          </Typography>
          <LinearProgress />
        </Box>
      ) : t.status === 'error' ? (
        <Alert severity='error' sx={{ my: 1 }} action={<Button color='inherit' size='small' onClick={onManage}>Ver</Button>}>
          {t.error || 'Não foi possível sincronizar este playback.'}
        </Alert>
      ) : (
        <>
          <Stack direction='row' sx={{ alignItems: 'center', gap: 0.5 }}>
            <IconButton size='small' aria-label='voltar 5 segundos' onClick={() => sync.seek(sync.time - 5)}>
              <Replay5RoundedIcon fontSize='small' />
            </IconButton>
            <IconButton
              aria-label={sync.playing ? 'pausar playback' : 'tocar playback'}
              onClick={sync.togglePlay}
              color='primary'
              sx={(th) => ({ backgroundColor: alpha(th.palette.primary.main, 0.12) })}
            >
              {sync.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            </IconButton>
            <IconButton size='small' aria-label='avançar 5 segundos' onClick={() => sync.seek(sync.time + 5)}>
              <Forward5RoundedIcon fontSize='small' />
            </IconButton>
            <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'text.secondary', minWidth: 34, textAlign: 'right' }}>
              {fmt(dragging ?? sync.time)}
            </Typography>
            <Slider
              size='small'
              aria-label='posição do playback'
              min={0}
              max={Math.max(1, sync.duration)}
              step={0.1}
              value={dragging ?? sync.time}
              onChange={(_, v) => setDragging(v as number)}
              onChangeCommitted={(_, v) => { setDragging(null); sync.seek(v as number); }}
              sx={{ mx: 1, flex: 1 }}
            />
            <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'text.secondary', minWidth: 34 }}>
              {fmt(sync.duration)}
            </Typography>
            <Tooltip title='Velocidade (sem mudar o tom)'>
              <Button
                size='small'
                color='inherit'
                onClick={(e) => setRateEl(e.currentTarget)}
                sx={{ minWidth: 0, px: 0.75, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
              >
                {sync.rate.toFixed(2).replace(/0$/, '')}x
              </Button>
            </Tooltip>
            <Menu anchorEl={rateEl} open={!!rateEl} onClose={() => setRateEl(null)}>
              {sync.rates.map((r) => (
                <MenuItem key={r} selected={r === sync.rate} onClick={() => { sync.setRate(r); setRateEl(null); }}>
                  {r.toFixed(2).replace(/0$/, '')}x
                </MenuItem>
              ))}
            </Menu>
          </Stack>

          <Stack direction='row' sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 28 }}>
            {sync.audioError ? (
              <Typography sx={{ fontSize: 12, color: 'error.main' }}>{sync.audioError}</Typography>
            ) : keyDiff !== 0 && onShiftKey ? (
              <Button size='small' onClick={() => onShiftKey(keyDiff)} sx={{ textTransform: 'none', fontSize: 12, px: 0.5 }}>
                Playback está {signed(keyDiff)} semitom{Math.abs(keyDiff) > 1 ? 's' : ''}: ajustar o tom da cifra
              </Button>
            ) : (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Toque numa linha para tocar dali</Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {sync.canAutoNext && (
              <FormControlLabel
                sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' } }}
                control={<Switch size='small' checked={sync.autoNext} onChange={(e) => sync.setAutoNext(e.target.checked)} />}
                label='Ao terminar, próxima'
              />
            )}
          </Stack>
        </>
      )}
    </Paper>
  );
}

// ---------------------------------------------------------------------------------------------
// Janela de playbacks
// ---------------------------------------------------------------------------------------------

export function PlaybackManagerDialog({ open, onClose, sync, lyricId, uid, lyricHtml }: {
  open: boolean;
  onClose: () => void;
  sync: PlaybackSync;
  lyricId: string;
  uid?: string;
  /** Cifra salva (para saber se mudou desde a sincronia). */
  lyricHtml?: string;
}) {
  const [label, setLabel] = React.useState('');
  const [upload, setUpload] = React.useState<{ name: string; progress: number; cancel: () => void } | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; label: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<PlaybackType | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [currentHash, setCurrentHash] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || !lyricHtml) return;
    let alive = true;
    cifraHash(lyricHtml).then((h) => alive && setCurrentHash(h)).catch(() => undefined);
    return () => { alive = false; };
  }, [open, lyricHtml]);

  const onFile = async (file: File | undefined) => {
    if (!file || !uid) return;
    if (file.size > MAX_PLAYBACK_BYTES) {
      enqueueSnackbar('O arquivo passa de 30 MB.', { variant: 'error' });
      return;
    }
    setUpload({ name: file.name, progress: 0, cancel: () => undefined });
    try {
      const h = await uploadPlayback({
        lyricId, uid, file, label,
        onProgress: (p) => setUpload((u) => (u ? { ...u, progress: p } : u)),
      });
      setUpload((u) => (u ? { ...u, cancel: h.cancel } : u));
      sync.pick(h.id);
      await h.done;
      setLabel('');
      enqueueSnackbar('Áudio enviado. A sincronia fica pronta em menos de um minuto.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar((e as Error).message || 'Não foi possível enviar o áudio.', { variant: 'error' });
    } finally {
      setUpload(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doRename = async () => {
    if (!editing) return;
    const v = editing.label.trim();
    setEditing(null);
    if (!v) return;
    try { await renamePlayback(editing.id, v); } catch { enqueueSnackbar('Não foi possível renomear.', { variant: 'error' }); }
  };

  const doResync = async (p: PlaybackType) => {
    if (!p.id) return;
    setBusy(p.id);
    try {
      await resyncPlayback(p.id);
      enqueueSnackbar('Sincronia refeita com a cifra atual.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar((e as Error).message || 'Não foi possível re-sincronizar.', { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    const p = confirmDelete;
    setConfirmDelete(null);
    if (!p?.id) return;
    setBusy(p.id);
    try { await deletePlayback(p); } catch { enqueueSnackbar('Não foi possível apagar.', { variant: 'error' }); } finally { setBusy(null); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
        <DialogTitle>Playbacks</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>
            Envie o mp3 do playback (ou da música) e a cifra passa sozinha junto com o áudio. Os arquivos ficam só na sua conta.
          </Typography>

          {sync.tracks.length > 0 && (
            <Stack sx={{ mb: 2 }} divider={<Divider flexItem />}>
              {sync.tracks.map((p) => {
                const isPicked = p.id === sync.track?.id;
                const changed = p.status === 'ready' && currentHash && p.cifraHash && p.cifraHash !== currentHash;
                const review = p.timeline?.filter((it) => it.conf != null && it.conf < 0.6).length ?? 0;
                return (
                  <Stack key={p.id} direction='row' sx={{ alignItems: 'center', gap: 1, py: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      {editing && editing.id === p.id ? (
                        <TextField
                          size='small'
                          autoFocus
                          fullWidth
                          value={editing.label}
                          onChange={(e) => { const v = e.target.value; setEditing((ed) => (ed ? { ...ed, label: v } : ed)); }}
                          onBlur={doRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setEditing(null); }}
                          slotProps={{ htmlInput: { maxLength: 60, 'aria-label': 'nome do playback' } }}
                        />
                      ) : (
                        <Typography noWrap sx={{ fontWeight: isPicked ? 700 : 500 }}>{p.label}</Typography>
                      )}
                      <Stack direction='row' sx={{ gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                        {statusChip(p)}
                        {p.status === 'ready' && (
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {fmt(p.durationSec ?? 0)}
                            {p.bpm ? ` · ${Math.round(p.bpm)} BPM` : ''}
                            {p.transpose ? ` · tom ${signed(p.transpose)}` : ''}
                            {review ? ` · ${review} linha${review > 1 ? 's' : ''} para conferir` : ''}
                          </Typography>
                        )}
                        {p.status === 'error' && (
                          <Typography sx={{ fontSize: 12, color: 'error.main' }}>{p.error}</Typography>
                        )}
                        {changed && (
                          <Typography sx={{ fontSize: 12, color: 'warning.main' }}>A cifra mudou depois da sincronia</Typography>
                        )}
                      </Stack>
                    </Box>
                    {p.status === 'ready' && !isPicked && (
                      <Button size='small' onClick={() => p.id && sync.pick(p.id)}>Usar</Button>
                    )}
                    {(changed || p.status === 'error') && p.analysisPath && (
                      <Tooltip title='Re-sincronizar com a cifra atual'>
                        <span>
                          <IconButton size='small' aria-label='re-sincronizar' disabled={busy === p.id} onClick={() => doResync(p)}>
                            <SyncRoundedIcon fontSize='small' />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip title='Renomear'>
                      <IconButton size='small' aria-label='renomear' onClick={() => p.id && setEditing({ id: p.id, label: p.label })}>
                        <EditRoundedIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title='Apagar'>
                      <span>
                        <IconButton size='small' aria-label='apagar' disabled={busy === p.id} onClick={() => setConfirmDelete(p)}>
                          <DeleteOutlineRoundedIcon fontSize='small' />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          )}

          {upload ? (
            <Box sx={{ py: 1 }}>
              <Typography noWrap sx={{ fontSize: 13, mb: 1 }}>Enviando {upload.name}… {Math.round(upload.progress * 100)}%</Typography>
              <Stack direction='row' sx={{ alignItems: 'center', gap: 1 }}>
                <LinearProgress variant='determinate' value={upload.progress * 100} sx={{ flex: 1 }} />
                <Button size='small' color='inherit' onClick={upload.cancel}>Cancelar</Button>
              </Stack>
            </Box>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, alignItems: { sm: 'center' } }}>
              <TextField
                size='small'
                label='Nome (opcional)'
                placeholder='Ex.: Karaokê original, Tom -2'
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                sx={{ flex: 1 }}
                slotProps={{ htmlInput: { maxLength: 60 } }}
              />
              <Button
                variant='contained'
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => fileRef.current?.click()}
                disabled={!uid}
              >
                Enviar áudio
              </Button>
              <input
                ref={fileRef}
                type='file'
                accept='audio/*,.mp3,.m4a,.wav'
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Apagar playback?</DialogTitle>
        <DialogContent>
          <Typography>“{confirmDelete?.label}” e o áudio enviado serão apagados. Não dá para desfazer.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button color='error' onClick={doDelete}>Apagar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
