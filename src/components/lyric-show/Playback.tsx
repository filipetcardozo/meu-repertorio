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
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import Portal from '@mui/material/Portal';
import { enqueueSnackbar } from 'notistack';
import { usePlaybackTime, type PlaybackSync } from '../../hooks/usePlaybackSync';
import type { PlaybackType } from '../../types/playbackType';
import {
  MAX_PLAYBACK_BYTES, cifraHash, deletePlayback, processingStale, renamePlayback, resyncPlayback, uploadPlayback,
  uploadStems,
} from '../../providers/playbacks/services';
import { collectStemFiles, type StemFile } from '../../lib/stemsImport';

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

// ---------------------------------------------------------------------------------------------
// Recolher e arrastar o player
// ---------------------------------------------------------------------------------------------

const BAR_LAYOUT_KEY = 'playbackBarLayout';
const VIEW_MARGIN = 8;
/** Acima disso (px) o gesto é arrasto, não clique. */
const DRAG_THRESHOLD = 5;
/** O que não começa arrasto (o resto do card é alça). */
const DRAG_EXCLUDE = 'button, a, input, label, [role="button"], [role="combobox"], [role="slider"], .MuiSlider-root, .MuiSwitch-root, .MuiChip-root';
/** Mesma camada dos cards de acorde: acima da barra do app, abaixo dos menus/diálogos. */
const FLOAT_Z = 1250;

type Pos = { x: number; y: number };
type BarLayout = { collapsed: boolean; pos: Pos | null };

function readBarLayout(): BarLayout {
  try {
    const v = JSON.parse(window.localStorage.getItem(BAR_LAYOUT_KEY) || 'null');
    const pos = v?.pos && Number.isFinite(v.pos.x) && Number.isFinite(v.pos.y) ? { x: v.pos.x, y: v.pos.y } : null;
    return { collapsed: !!v?.collapsed, pos };
  } catch {
    return { collapsed: false, pos: null };
  }
}

function clampPos(p: Pos, w: number, h: number): Pos {
  const maxX = Math.max(VIEW_MARGIN, window.innerWidth - w - VIEW_MARGIN);
  const maxY = Math.max(VIEW_MARGIN, window.innerHeight - h - VIEW_MARGIN);
  return {
    x: Math.min(Math.max(VIEW_MARGIN, p.x), maxX),
    y: Math.min(Math.max(VIEW_MARGIN, p.y), maxY),
  };
}

/**
 * Estado do player: recolhido (só o ícone) ou aberto, e posição livre na tela
 * (`pos` null = no lugar padrão, acima dos controles). Fica salvo no navegador.
 */
function useBarLayout() {
  const [layout, setLayout] = React.useState<BarLayout>(readBarLayout);
  const elRef = React.useRef<HTMLElement | null>(null);
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  const setRef = React.useCallback((node: HTMLElement | null) => { elRef.current = node; setEl(node); }, []);

  React.useEffect(() => {
    try { window.localStorage.setItem(BAR_LAYOUT_KEY, JSON.stringify(layout)); } catch { /* sem storage */ }
  }, [layout]);

  // Mantém dentro da tela quando o tamanho do player ou da janela muda.
  React.useEffect(() => {
    if (!el) return;
    const fit = () => setLayout((l) => {
      if (!l.pos) return l;
      const r = el.getBoundingClientRect();
      const p = clampPos(l.pos, r.width, r.height);
      return p.x === l.pos.x && p.y === l.pos.y ? l : { ...l, pos: p };
    });
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit); };
  }, [el]);

  /** O último gesto foi arrasto: o `click` que vem depois dele deve ser ignorado. */
  const draggedRef = React.useRef(false);
  const consumeDrag = React.useCallback(() => {
    const d = draggedRef.current;
    draggedRef.current = false;
    return d;
  }, []);
  const [dragging, setDragging] = React.useState(false);

  /**
   * Arrastar como nos cards de acorde: o card inteiro serve de alça, menos os controles.
   * Os ouvintes ficam na janela porque, no primeiro arrasto, o player sai da coluna dos
   * controles para um portal (o elemento é recriado e perderia o pointer capture).
   */
  const onPointerDown = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    // Eventos de menus (portais) também chegam aqui pela árvore do React.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (e.button !== 0 || !elRef.current) return;
    const hit = (e.target as Element).closest(DRAG_EXCLUDE);
    if (hit && hit !== e.currentTarget) return;
    const rect = elRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const id = e.pointerId;
    let moved = false;
    draggedRef.current = false;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        draggedRef.current = true;
        setDragging(true);
      }
      ev.preventDefault();
      const r = elRef.current?.getBoundingClientRect() ?? rect;
      const pos = clampPos({ x: rect.left + dx, y: rect.top + dy }, r.width, r.height);
      setLayout((l) => ({ ...l, pos }));
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, []);

  return {
    ...layout,
    setRef,
    onPointerDown,
    dragging,
    consumeDrag,
    setCollapsed: (collapsed: boolean) => setLayout((l) => ({ ...l, collapsed })),
    resetPos: () => setLayout((l) => ({ ...l, pos: null })),
  };
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
  const bar = useBarLayout();
  const time = usePlaybackTime(sync.timeStore);
  const t = sync.track;
  if (!sync.open || !t) return null;

  /** Solto na tela: fora da coluna dos controles (que tem transform), num portal com posição fixa. */
  const place = (node: React.ReactElement) => (bar.pos ? <Portal>{node}</Portal> : node);
  /** Mesmo visual e arrasto dos cards de acorde. */
  const cardSx = {
    ...(bar.pos ? { position: 'fixed' as const, left: bar.pos.x, top: bar.pos.y, zIndex: FLOAT_Z } : {}),
    pointerEvents: 'auto' as const,
    borderRadius: 2,
    border: 1,
    borderColor: 'divider',
    // Sem isso o toque no celular rola a página em vez de arrastar o card.
    touchAction: 'none' as const,
    userSelect: 'none' as const,
    cursor: bar.dragging ? 'grabbing' : 'grab',
  };
  const cardProps = {
    ref: bar.setRef,
    elevation: 8,
    'data-follow-controls': true,
    onPointerDown: bar.onPointerDown,
    onDoubleClick: (e: React.MouseEvent) => {
      if (!(e.target as Element).closest(DRAG_EXCLUDE)) bar.resetPos();
    },
  };

  if (bar.collapsed) {
    return place(
      <Tooltip title='Abrir o player · arraste para mover'>
        <Paper
          {...cardProps}
          onDoubleClick={undefined}
          role='button'
          tabIndex={0}
          aria-label='abrir o player do playback'
          onClick={() => { if (!bar.consumeDrag()) bar.setCollapsed(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bar.setCollapsed(false); } }}
          sx={{
            ...cardSx,
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'primary.main',
            borderColor: sync.playing ? 'primary.main' : 'divider',
          }}
        >
          <QueueMusicRoundedIcon />
        </Paper>
      </Tooltip>,
    );
  }

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

  return place(
    <Paper
      {...cardProps}
      sx={{
        ...cardSx,
        width: 'min(520px, calc(100vw - 32px))',
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
        <Tooltip title='Recolher o player'>
          <IconButton size='small' aria-label='recolher o player' onClick={() => bar.setCollapsed(true)}>
            <RemoveRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>
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
              {importedStems(t) ? 'Junta as faixas' : 'Separa os instrumentos'}, reconhece a letra na voz e sincroniza
              com a cifra. Leva alguns minutos; pode fechar e voltar depois.
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
            <IconButton size='small' aria-label='voltar 5 segundos' onClick={() => sync.seek(time - 5)}>
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
            <IconButton size='small' aria-label='avançar 5 segundos' onClick={() => sync.seek(time + 5)}>
              <Forward5RoundedIcon fontSize='small' />
            </IconButton>
            <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'text.secondary', minWidth: 34, textAlign: 'right' }}>
              {fmt(dragging ?? time)}
            </Typography>
            <Slider
              size='small'
              aria-label='posição do playback'
              min={0}
              max={Math.max(1, sync.duration)}
              step={0.1}
              value={dragging ?? time}
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
  // faixas importadas (ex.: Moises): ver src/lib/stemsImport.ts
  lead_vocals: 'Voz principal', backing_vocals: 'Backing vocal', instrumental: 'Instrumental',
  acoustic_guitar: 'Violão', electric_guitar: 'Guitarra elétrica', keys: 'Teclado', strings: 'Cordas',
  wind: 'Sopros', percussion: 'Percussão', kick: 'Bumbo', snare: 'Caixa', toms: 'Tons', hihat: 'Chimbal',
  cymbals: 'Pratos', click: 'Metrônomo',
};

const stemLabel = (name: string, label?: string | null) => label || STEM_LABELS[name] || name;
const importedStems = (p: PlaybackType | null | undefined) => p?.source === 'stems';

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
  if (p.localWorker === 'waiting') return 'Esperando o processamento no seu PC (yarn dev:local)…';
  const base = importedStems(p) && p.stage === 'separating'
    ? 'Preparando as faixas…'
    : STAGE_TEXT[p.stage ?? 'queued'] ?? 'Processando…';
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
  const n = p.stems.tracks?.length ?? 0;
  const base = importedStems(p) ? `${n} faixa${n === 1 ? '' : 's'} importada${n === 1 ? '' : 's'}` : 'Instrumentos separados';
  return p.voiceWords ? `${base} · sincronizado pela letra` : base;
}

const MIXER_KEY = 'playbackMixerOpen';

function StemsSection({ sync }: { sync: PlaybackSync }) {
  const st = sync.stems;
  const info = st.info;
  // Volumes abertos (lembra no aparelho)
  const [mixerOpen, setMixerOpenState] = React.useState(() => {
    try { return window.localStorage.getItem(MIXER_KEY) === '1'; } catch { return false; }
  });
  const setMixerOpen = (v: boolean) => {
    setMixerOpenState(v);
    try { window.localStorage.setItem(MIXER_KEY, v ? '1' : '0'); } catch { /* sem storage */ }
  };

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
  const imported = info.model === 'import';
  const anySolo = st.names.some((n) => st.mix[n]?.solo);
  const changed = st.names.some((n) => st.mix[n] && (st.mix[n].solo || !st.mix[n].on || (st.mix[n].vol ?? 1) !== 1));
  const guitarOff = !imported && st.names.includes('guitar') && st.gains[st.names.indexOf('guitar')] === 0;
  const showing = st.useStems && st.available && !st.error;
  const switchLabel = imported ? 'Faixas' : 'Faixas separadas';

  const chip = (n: string, i: number, fixedWidth?: boolean) => {
    const m = st.mix[n] ?? { on: true, solo: false };
    const audible = st.audible[i];
    const label = stemLabel(n, st.labels[i]);
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
          ...(fixedWidth ? { width: 136, justifyContent: 'space-between', flexShrink: 0 } : {}),
        }}
      />
    );
  };

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
              slotProps={{ input: { 'aria-label': `tocar com as ${switchLabel.toLowerCase()}` } }}
            />
          )}
          label={st.available ? switchLabel : `${switchLabel} (este navegador não toca)`}
        />
        {st.loading && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>carregando as faixas…</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {st.active && changed && (
          <Tooltip title='Todas ligadas, sem solo e no volume normal'>
            <Button size='small' color='inherit' onClick={st.reset} sx={{ textTransform: 'none', fontSize: 12, minWidth: 0 }}>
              Restaurar
            </Button>
          </Tooltip>
        )}
        {showing && (
          <Tooltip title={mixerOpen ? 'Esconder os volumes' : 'Volume de cada faixa'}>
            <IconButton
              size='small'
              aria-label='volumes das faixas'
              aria-pressed={mixerOpen}
              color={mixerOpen ? 'primary' : 'default'}
              onClick={() => setMixerOpen(!mixerOpen)}
            >
              <TuneRoundedIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {st.loading && <LinearProgress sx={{ mb: 0.5 }} />}
      {st.error && <Typography sx={{ fontSize: 12, color: 'error.main' }}>{st.error}</Typography>}
      {showing && (
        <>
          {mixerOpen ? (
            <Stack
              role='group'
              aria-label='volumes das faixas'
              sx={{ py: 0.5, gap: 0.25, maxHeight: '40vh', overflowY: 'auto', overflowX: 'hidden', pr: 0.5 }}
            >
              {st.names.map((n, i) => {
                const vol = st.mix[n]?.vol ?? 1;
                const label = stemLabel(n, st.labels[i]);
                return (
                  <Stack key={n} direction='row' sx={{ alignItems: 'center', gap: 1.5, minHeight: 30 }}>
                    {chip(n, i, true)}
                    <Slider
                      size='small'
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(vol * 100)}
                      disabled={!st.active}
                      onChange={(_, v) => st.setVolume(n, (v as number) / 100)}
                      slotProps={{ input: { 'aria-label': `volume de ${label}` } }}
                      sx={{ flex: 1, opacity: st.audible[i] ? 1 : 0.45 }}
                    />
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(vol * 100)}%
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 0.75, py: 0.5 }} role='group' aria-label='faixas'>
              {st.names.map((n, i) => chip(n, i))}
            </Stack>
          )}
          <Typography sx={{ fontSize: 11.5, color: guitarOff ? 'warning.main' : 'text.secondary', lineHeight: 1.35 }}>
            {imported ? '' : `${STEMS_LIMIT_TEXT} `}
            Toque para ligar/desligar; <HeadphonesRoundedIcon sx={{ fontSize: 12, verticalAlign: '-2px' }} /> ouve só a faixa
            {mixerOpen ? '.' : <>; <TuneRoundedIcon sx={{ fontSize: 12, verticalAlign: '-2px' }} /> ajusta o volume de cada uma.</>}
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
  const stemsRef = React.useRef<HTMLInputElement>(null);
  /** Faixas escolhidas, esperando confirmar a importação. */
  const [pending, setPending] = React.useState<StemFile[] | null>(null);
  const [reading, setReading] = React.useState(false);

  const onStemFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (stemsRef.current) stemsRef.current.value = '';
    if (!files.length) return;
    setReading(true);
    try {
      setPending(await collectStemFiles(files));
    } catch (e) {
      enqueueSnackbar((e as Error).message || 'Não foi possível ler as faixas.', { variant: 'error' });
    } finally {
      setReading(false);
    }
  };

  const doImport = async () => {
    const stems = pending;
    if (!stems?.length || !uid) return;
    setPending(null);
    setUpload({ name: `${stems.length} faixas`, progress: 0, cancel: () => undefined });
    try {
      const h = await uploadStems({
        lyricId, uid, stems, label,
        onProgress: (p) => setUpload((u) => (u ? { ...u, progress: p } : u)),
      });
      setUpload((u) => (u ? { ...u, cancel: h.cancel } : u));
      sync.pick(h.id);
      await h.done;
      setLabel('');
      enqueueSnackbar('Faixas enviadas. Juntar as faixas, reconhecer a letra e sincronizar leva alguns minutos.', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar((e as Error).message || 'Não foi possível enviar as faixas.', { variant: 'error' });
    } finally {
      setUpload(null);
    }
  };

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
            Envie o mp3 do playback (ou da música) e a cifra passa sozinha junto com o áudio. Já tem as faixas separadas (ex.: exportadas do Moises)? Use Importar faixas. Os arquivos ficam só na sua conta.
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
              <Tooltip title='Faixas já separadas (ex.: exportadas do Moises): vários arquivos ou o .zip'>
                <span>
                  <Button
                    variant='outlined'
                    startIcon={reading ? <CircularProgress size={16} color='inherit' /> : <LibraryMusicRoundedIcon />}
                    onClick={() => stemsRef.current?.click()}
                    disabled={!uid || reading}
                    sx={{ whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
                  >
                    Importar faixas
                  </Button>
                </span>
              </Tooltip>
              <input
                ref={fileRef}
                type='file'
                accept='audio/*,.mp3,.m4a,.wav'
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <input
                ref={stemsRef}
                type='file'
                multiple
                accept='audio/*,.mp3,.m4a,.wav,.flac,.ogg,.aiff,.zip'
                hidden
                onChange={(e) => onStemFiles(e.target.files)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pending} onClose={() => setPending(null)} fullWidth maxWidth='xs'>
        <DialogTitle>Importar {pending?.length ?? 0} faixa{pending?.length === 1 ? '' : 's'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
            Viram um playback só: no player dá para ligar, desligar, ouvir só uma e ajustar o volume de cada
            faixa. A letra é reconhecida na faixa de voz.
          </Typography>
          <Stack divider={<Divider flexItem />}>
            {pending?.map((s) => (
              <Stack key={s.name} direction='row' sx={{ alignItems: 'center', gap: 1, py: 0.75 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14, minWidth: 120 }}>{s.label}</Typography>
                <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', flex: 1, minWidth: 0 }} title={s.file.name}>
                  {s.file.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {(s.file.size / 1024 / 1024).toFixed(1)} MB
                </Typography>
              </Stack>
            ))}
          </Stack>
          {pending && !pending.some((s) => ['vocals', 'lead_vocals', 'backing_vocals'].includes(s.name)) && (
            <Alert severity='info' sx={{ mt: 1.5 }}>
              Nenhuma faixa de voz: a sincronia com a cifra vai só pelos acordes.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Cancelar</Button>
          <Button variant='contained' onClick={doImport}>Importar</Button>
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
