import React, { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Markup } from 'interweave';
import { getAuth } from 'firebase/auth';
import type { lyricType } from '../../types/lyricType';
import { getLyric, updateLyric } from '../../providers/lyrics/services';
import { decorateSectionTitles } from '../../utils/sectionTitles';
import { chordSheetMarksSx } from './chordSheetStyles';
import { displayFontFamily, monoFont } from '../../theme/createAppTheme';

type Props = {
  lyricId: string;
  /** Há ajuste de tom ainda não salvo: é salvo antes de recarregar */
  hasUnsavedOffset?: boolean;
  saveOffset?: () => Promise<void> | void;
  size?: 'small' | 'medium';
};

type Change = { tipo: string; descricao: string };
type Result = { lyric: string; tone: string; changes: Change[] };

const CHANGE_LABEL: Record<string, string> = {
  alinhamento: 'Alinhamento',
  secao: 'Seções',
  notacao: 'Notação',
  espacamento: 'Espaçamento',
  outro: 'Outro',
};

const STEPS = ['Lendo a cifra…', 'Alinhando os acordes com as sílabas…', 'Marcando as partes da música…', 'Padronizando os acordes…', 'Conferindo letra e acordes…'];

// O servidor diz uma vez se a IA está configurada; sem ela o botão nem aparece.
let enabledPromise: Promise<boolean> | null = null;
const aiEnabled = () =>
  (enabledPromise ??= fetch('/api/ai/improve-cifra')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d) => !!d.enabled)
    .catch(() => false));

/** Botão "Melhorar cifra com IA" + diálogo de revisão (antes/depois). Nada é salvo sem aprovação. */
export const ImproveCifraWithAiButton = (props: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    aiEnabled().then((v) => alive && setEnabled(v));
    return () => {
      alive = false;
    };
  }, []);
  if (!enabled) return null;
  return (
    <>
      <Tooltip title='Melhorar cifra com IA'>
        <IconButton aria-label='melhorar cifra com IA' onClick={() => setOpen(true)} color='inherit' size={props.size}>
          <AutoAwesomeIcon color='primary' fontSize={props.size} />
        </IconButton>
      </Tooltip>
      {open && <ImproveDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
};

const sheetSx = (theme: Theme) => ({
  maxHeight: { xs: 'none', md: '52vh' },
  overflow: 'auto',
  p: 2,
  borderRadius: '12px',
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025),
  ...monoFont,
  fontSize: 13,
  lineHeight: 1.45,
  '& pre': { fontFamily: 'inherit', fontSize: 'inherit', m: 0, whiteSpace: 'pre' },
  '& b': { color: 'chord.main' },
  ...chordSheetMarksSx(theme),
  '& .tablatura': { color: 'text.secondary' },
});

const ImproveDialog = ({ lyricId, hasUnsavedOffset, saveOffset, onClose }: Props & { onClose: () => void }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const sideBySide = useMediaQuery(theme.breakpoints.up('md'));
  const [lyric, setLyric] = useState<lyricType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<'depois' | 'antes'>('depois');
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getLyric(lyricId)
      .then((l) => (l ? setLyric({ ...l, id: lyricId }) : setError('Música não encontrada.')))
      .catch(() => setError('Não foi possível carregar a música.'));
    return () => abortRef.current?.abort();
  }, [lyricId]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 7000);
    return () => window.clearInterval(timer);
  }, [running]);

  const run = async () => {
    if (!lyric) return;
    setStep(0);
    setRunning(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Entre na sua conta para usar a IA.');
      const res = await fetch('/api/ai/improve-cifra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lyric: lyric.lyric,
          lyricName: lyric.lyricName,
          composerName: lyric.composerName,
          originalTone: lyric.originalTone,
        }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Não foi possível melhorar a cifra.');
      setResult(body as Result);
      setView('depois');
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Não foi possível melhorar a cifra.');
    } finally {
      setRunning(false);
    }
  };

  const apply = async () => {
    if (!result || !lyric?.id) return;
    setSaving(true);
    setError(null);
    try {
      // O ajuste de tom fica no cadastro do usuário: só garante que o atual está salvo antes de recarregar.
      if (hasUnsavedOffset && saveOffset) await saveOffset();
      await updateLyric(lyric.id, {
        ...lyric,
        lyric: result.lyric,
        originalTone: lyric.originalTone || result.tone,
      });
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar.');
      setSaving(false);
    }
  };

  const nothingToDo = result && result.changes.length === 0;
  const toneSuggestion = result?.tone && lyric?.originalTone && result.tone !== lyric.originalTone ? result.tone : null;

  const before = lyric ? <Box sx={sheetSx(theme)}><Markup content={decorateSectionTitles(lyric.lyric)} /></Box> : null;
  const after = result ? <Box sx={sheetSx(theme)}><Markup content={decorateSectionTitles(result.lyric)} /></Box> : null;

  return (
    <Dialog open onClose={saving || running ? undefined : onClose} fullWidth maxWidth={result && sideBySide ? 'lg' : 'sm'} fullScreen={fullScreen}>
      <DialogTitle sx={{ fontFamily: displayFontFamily, fontWeight: 600, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon color='primary' fontSize='small' />
        Melhorar cifra com IA
      </DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        {!result && !running && (
          <>
            <Typography variant='body2' sx={{ color: 'text.secondary' }}>
              A IA alinha os acordes com as sílabas, marca as partes da música (Intro, Refrão…), padroniza a escrita
              dos acordes e limpa os espaços.
            </Typography>
            <Box component='ul' sx={{ pl: 2.5, my: 1.5, color: 'text.secondary', fontSize: 14, '& li': { mb: 0.5 } }}>
              <li>A letra e a sequência de acordes não mudam: o app confere antes de mostrar.</li>
              <li>Você vê o antes e o depois, e nada é salvo sem a sua aprovação.</li>
            </Box>
          </>
        )}

        {running && (
          <Box sx={{ py: 3 }}>
            <Typography sx={{ fontWeight: 500, mb: 1.5 }}>{STEPS[step]}</Typography>
            <LinearProgress sx={{ borderRadius: 4, height: 6 }} />
            <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              Pode levar até um minuto.
            </Typography>
          </Box>
        )}

        {error && <Alert severity='error' sx={{ mt: 1 }}>{error}</Alert>}

        {nothingToDo && (
          <Alert icon={<CheckCircleOutlineIcon />} severity='success'>
            Esta cifra já está ótima. A IA não encontrou nada para melhorar.
          </Alert>
        )}

        {result && !nothingToDo && (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
              {[...new Set(result.changes.map((c) => c.tipo))].map((t) => (
                <Chip key={t} size='small' label={CHANGE_LABEL[t] ?? t} color='primary' variant='outlined' />
              ))}
            </Box>
            <Box component='ul' sx={{ pl: 2.5, mt: 0, mb: 2, fontSize: 14, '& li': { mb: 0.25 } }}>
              {result.changes.map((c, i) => (
                <li key={i}>{c.descricao}</li>
              ))}
            </Box>
            {toneSuggestion && (
              <Alert severity='info' sx={{ mb: 1.5 }}>
                A IA acha que o tom é {toneSuggestion} (cadastrado: {lyric?.originalTone}). O tom cadastrado não muda.
              </Alert>
            )}

            {sideBySide ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant='overline' sx={{ color: 'text.secondary' }}>Antes</Typography>
                  {before}
                </Box>
                <Box>
                  <Typography variant='overline' sx={{ color: 'primary.main' }}>Depois</Typography>
                  {after}
                </Box>
              </Box>
            ) : (
              <>
                <ToggleButtonGroup size='small' exclusive value={view} onChange={(_, v) => v && setView(v)} sx={{ mb: 1 }}>
                  <ToggleButton value='depois'>Depois</ToggleButton>
                  <ToggleButton value='antes'>Antes</ToggleButton>
                </ToggleButtonGroup>
                {view === 'depois' ? after : before}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving || running} color='inherit'>
          {result && !nothingToDo ? 'Descartar' : 'Fechar'}
        </Button>
        {result && !nothingToDo ? (
          <Button variant='contained' onClick={apply} loading={saving}>
            Aplicar
          </Button>
        ) : !result ? (
          <Button variant='contained' onClick={run} loading={running} disabled={!lyric} startIcon={<AutoAwesomeIcon />}>
            {error ? 'Tentar de novo' : 'Melhorar'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};
