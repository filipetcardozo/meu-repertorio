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
import CircularProgress from '@mui/material/CircularProgress';
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
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import { enqueueSnackbar } from 'notistack';
import type { PlaybackSync } from '../../hooks/usePlaybackSync';
import type { PlaybackType } from '../../types/playbackType';
import {
  MAX_PLAYBACK_BYTES, cifraHash, deletePlayback, processingStale, renamePlayback, resyncPlayback, uploadPlayback,
} from '../../providers/playbacks/services';

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
/** Acima disso (em semitons) a transposição do áudio começa a soar artificial. */
const NATURAL_SHIFT = 4;

function statusChip(p: PlaybackType) {
  switch (p.status) {
    case 'uploading': return <Chip size='small' label='Enviando' />;
    case 'processing': return <Chip size='small' color='info' label='Processando' />;
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

/** sha1 da cifra salva, calculado no navegador (mesmo hash que a Function grava em `cifraHash`). */
function useCifraHash(lyricHtml: string | undefined, enabled: boolean): string | null {
  const [hash, setHash] = React.useState<{ html: string; hash: string } | null>(null);
  React.useEffect(() => {
    if (!enabled || !lyricHtml) return;
    let alive = true;
    cifraHash(lyricHtml).then((h) => alive && setHash({ html: lyricHtml, hash: h })).catch(() => undefined);
    return () => { alive = false; };
  }, [enabled, lyricHtml]);
  return hash && hash.html === lyricHtml ? hash.hash : null;
}

/** A cifra mudou depois que este playback foi sincronizado (e dá para refazer só o alinhamento). */
function cifraChanged(p: PlaybackType | null | undefined, currentHash: string | null): boolean {
  return !!(p && p.status === 'ready' && p.analysisPath && currentHash && p.cifraHash && p.cifraHash !== currentHash);
}

async function resyncWithFeedback(id: string) {
  try {
    await resyncPlayback(id);
    enqueueSnackbar('Playback sincronizado de novo com a cifra atual.', { variant: 'success' });
  } catch (e) {
    enqueueSnackbar((e as Error).message || 'Não foi possível re-sincronizar.', { variant: 'error' });
  }
}

export function PlaybackBar({ sync, onManage, lyricHtml }: {
  sync: PlaybackSync;
  onManage: () => void;
  /** Cifra salva: se mudou desde a sincronia, o player oferece sincronizar de novo. */
  lyricHtml?: string;
}) {
  const [menuEl, setMenuEl] = React.useState<HTMLElement | null>(null);
  const [rateEl, setRateEl] = React.useState<HTMLElement | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [resyncing, setResyncing] = React.useState<string | null>(null);
  const currentHash = useCifraHash(lyricHtml, sync.open);
  const t = sync.track;
  if (!sync.open || !t) return null;

  const ready = sync.readyTrack;
  const outdated = cifraChanged(ready, currentHash);
  const doResync = async () => {
    if (!ready?.id) return;
    setResyncing(ready.id);
    await resyncWithFeedback(ready.id);
    setResyncing(null);
  };
  const wanted = sync.wantedSemitones;
  const keyLabel = wanted === 0
    ? 'Áudio no tom da cifra'
    : `Áudio no tom da cifra (${signed(wanted)} semitom${Math.abs(wanted) > 1 ? 's' : ''})`;

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

      {outdated && t.status === 'ready' && (
        <Alert
          severity='warning'
          icon={<SyncRoundedIcon fontSize='small' />}
          sx={{ my: 0.5, py: 0, alignItems: 'center', '& .MuiAlert-message': { fontSize: 12.5 } }}
          action={(
            <Button
              color='inherit'
              size='small'
              disabled={resyncing === ready?.id}
              startIcon={resyncing === ready?.id ? <CircularProgress size={14} color='inherit' /> : null}
              onClick={doResync}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {resyncing === ready?.id ? 'Sincronizando…' : 'Sincronizar de novo'}
            </Button>
          )}
        >
          A cifra mudou depois da sincronia deste playback.
        </Alert>
      )}

      {sync.stale ? (
        <Alert
          severity='error'
          sx={{ my: 1 }}
          action={<ReprocessButton sync={sync} label='Processar de novo' />}
        >
          O processamento parou no meio.
        </Alert>
      ) : t.status === 'uploading' || t.status === 'processing' ? (
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
            {t.status === 'uploading' ? 'Enviando o áudio…' : processingText(t)}
          </Typography>
          <LinearProgress
            variant={t.status === 'processing' && t.stage && t.stage !== 'queued' ? 'determinate' : 'indeterminate'}
            value={Math.round((t.progress ?? 0) * 100)}
          />
          {t.status === 'processing' && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75 }}>
              Separa os instrumentos, reconhece a letra na voz e sincroniza com a cifra. Leva alguns minutos;
              pode fechar e voltar depois.
            </Typography>
          )}
        </Box>
      ) : t.status === 'error' ? (
        <Alert
          severity='error'
          sx={{ my: 1 }}
          action={<ReprocessButton sync={sync} label='Tentar de novo' />}
        >
          {t.error || 'Não foi possível processar este playback.'}
        </Alert>
      ) : sync.audioLoading ? (
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>Carregando o áudio…</Typography>
          <LinearProgress />
        </Box>
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
            ) : sync.pitchAvailable ? (
              <Tooltip
                title={sync.followKey
                  ? 'O áudio muda de tom junto com a cifra. Desligue para ouvir o tom original do playback.'
                  : 'Ligue para o áudio mudar de tom junto com a cifra.'}
              >
                <FormControlLabel
                  sx={{ mr: 0, ml: -0.5, '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' } }}
                  control={<Switch size='small' checked={sync.followKey} onChange={(e) => sync.setFollowKey(e.target.checked)} />}
                  label={keyLabel}
                />
              </Tooltip>
            ) : (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {wanted !== 0 ? `Áudio no tom original (${signed(-wanted)} da cifra): este navegador não transpõe` : 'Toque numa linha para tocar dali'}
              </Typography>
            )}
            {sync.pitchAvailable && sync.followKey && Math.abs(wanted) > NATURAL_SHIFT && (
              <Typography sx={{ fontSize: 12, color: 'warning.main' }}>transposição grande: pode soar artificial</Typography>
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
          <StemsSection sync={sync} />
        </>
      )}
    </Paper>
  );
}

// ---------------------------------------------------------------------------------------------
// Faixas separadas (dentro do player)
// ---------------------------------------------------------------------------------------------

export const STEM_LABELS: Record<string, string> = {
  vocals: 'Voz', drums: 'Bateria', bass: 'Baixo', guitar: 'Guitarra', piano: 'Piano', other: 'Outros',
};

/** Limite do modelo, sempre visível junto das faixas. */
export const STEMS_LIMIT_TEXT =
  'A separação é por tipo de instrumento: base e solo de guitarra (e violão) ficam juntos em Guitarra. '
  + 'Desligar Guitarra tira os dois.';

const STAGE_TEXT: Record<string, string> = {
  queued: 'Na fila para processar…',
  separating: 'Separando os instrumentos…',
  transcribing: 'Reconhecendo a letra na voz…',
  syncing: 'Sincronizando com a cifra…',
};

export function processingText(p: PlaybackType): string {
  const base = STAGE_TEXT[p.stage ?? 'queued'] ?? 'Processando…';
  return p.stage && p.stage !== 'queued' ? `${base} ${Math.round((p.progress ?? 0) * 100)}%` : base;
}

/** Processa o playback atual de novo (faixas, voz e sincronia). */
function ReprocessButton({ sync, label, variant }: { sync: PlaybackSync; label: string; variant?: 'text' | 'outlined' }) {
  const ask = async () => {
    try {
      await sync.reprocess();
    } catch (e) {
      enqueueSnackbar((e as Error).message || 'Não foi possível iniciar o processamento.', { variant: 'error' });
    }
  };
  return (
    <Button
      color='inherit'
      size='small'
      variant={variant}
      startIcon={sync.reprocessing ? <CircularProgress size={14} color='inherit' /> : <CallSplitRoundedIcon fontSize='small' />}
      disabled={sync.reprocessing}
      onClick={ask}
      sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
    >
      {label}
    </Button>
  );
}

function stemsStatusText(p: PlaybackType): string | null {
  if (p.status !== 'ready') return null;
  if (!p.stems) return 'Sem faixas separadas (processado antes da voz)';
  if (p.stems.status === 'error') return 'Não foi possível separar os instrumentos';
  return p.voiceWords ? 'Instrumentos separados · sincronizado pela letra' : 'Instrumentos separados';
}

function StemsSection({ sync }: { sync: PlaybackSync }) {
  const st = sync.stems;
  const info = st.info;

  if (!info || info.status === 'error') {
    return (
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <ReprocessButton sync={sync} label={info ? 'Processar de novo' : 'Processar com a voz'} />
        <Typography sx={{ fontSize: 12, color: info ? 'error.main' : 'text.secondary', flex: 1, minWidth: 160 }}>
          {info
            ? (info.error || 'Não foi possível separar os instrumentos.')
            : 'Separa voz, bateria, baixo, guitarra, piano e outros e refaz a sincronia pela letra. Leva alguns minutos.'}
        </Typography>
      </Stack>
    );
  }

  // pronto
  const anySolo = st.names.some((n) => st.mix[n]?.solo);
  const changed = st.names.some((n) => st.mix[n] && (st.mix[n].solo || !st.mix[n].on));
  const guitarOff = st.names.includes('guitar') && st.gains[st.names.indexOf('guitar')] === 0;
  return (
    <Box sx={{ py: 0.5, borderTop: 1, borderColor: 'divider' }}>
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1, minHeight: 30 }}>
        <FormControlLabel
          sx={{ mr: 0, ml: -0.5, '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' } }}
          control={(
            <Switch
              size='small'
              checked={st.useStems && st.available}
              disabled={!st.available}
              onChange={(e) => st.setUseStems(e.target.checked)}
              slotProps={{ input: { 'aria-label': 'tocar com as faixas separadas' } }}
            />
          )}
          label={st.available ? 'Faixas separadas' : 'Faixas separadas (este navegador não toca)'}
        />
        {st.loading && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>carregando as faixas…</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {st.active && changed && (
          <Button size='small' color='inherit' onClick={st.reset} sx={{ textTransform: 'none', fontSize: 12, minWidth: 0 }}>
            Todas
          </Button>
        )}
      </Stack>
      {st.loading && <LinearProgress sx={{ mb: 0.5 }} />}
      {st.error && <Typography sx={{ fontSize: 12, color: 'error.main' }}>{st.error}</Typography>}
      {st.useStems && st.available && !st.error && (
        <>
          <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 0.75, py: 0.5 }} role='group' aria-label='faixas'>
            {st.names.map((n, i) => {
              const m = st.mix[n] ?? { on: true, solo: false };
              const audible = st.gains[i] > 0;
              const label = STEM_LABELS[n] ?? n;
              return (
                <Chip
                  key={n}
                  size='small'
                  label={label}
                  color={m.solo ? 'secondary' : 'primary'}
                  variant={audible ? 'filled' : 'outlined'}
                  disabled={!st.active}
                  onClick={() => st.toggle(n)}
                  onDelete={() => st.solo(n)}
                  deleteIcon={(
                    <Tooltip title={m.solo ? `Tirar ${label} do solo` : `Ouvir só ${label}`}>
                      <HeadphonesRoundedIcon aria-label={m.solo ? `tirar ${label} do solo` : `ouvir só ${label}`} />
                    </Tooltip>
                  )}
                  aria-pressed={audible}
                  aria-label={`${label}: ${audible ? 'ligada' : 'desligada'}${m.solo ? ', em solo' : ''}`}
                  sx={{
                    fontWeight: 600,
                    textDecoration: audible ? 'none' : 'line-through',
                    opacity: !audible && anySolo && !m.on ? 0.6 : 1,
                  }}
                />
              );
            })}
          </Stack>
          <Typography sx={{ fontSize: 11.5, color: guitarOff ? 'warning.main' : 'text.secondary', lineHeight: 1.35 }}>
            {STEMS_LIMIT_TEXT}
            {' '}Toque para ligar/desligar; <HeadphonesRoundedIcon sx={{ fontSize: 12, verticalAlign: '-2px' }} /> ouve só a faixa.
          </Typography>
        </>
      )}
    </Box>
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
  const currentHash = useCifraHash(lyricHtml, open);
  const fileRef = React.useRef<HTMLInputElement>(null);

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
      enqueueSnackbar('Áudio enviado. Separar os instrumentos, reconhecer a letra e sincronizar leva alguns minutos.', { variant: 'success' });
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
    await resyncWithFeedback(p.id);
    setBusy(null);
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
                const changed = cifraChanged(p, currentHash);
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
                        {p.status === 'processing' && (
                          <Typography sx={{ fontSize: 12, color: processingStale(p) ? 'error.main' : 'text.secondary' }}>
                            {processingStale(p) ? 'O processamento parou no meio' : processingText(p)}
                          </Typography>
                        )}
                        {stemsStatusText(p) && (
                          <Typography sx={{ fontSize: 12, color: p.stems?.status === 'error' ? 'error.main' : 'text.secondary' }}>
                            {stemsStatusText(p)}
                          </Typography>
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
