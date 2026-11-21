import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { alpha, type Theme } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import VolumeDownRoundedIcon from '@mui/icons-material/VolumeDownRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import Slider from '@mui/material/Slider';
import { getPracticeVolume, setPracticeVolume, subscribePracticeVolume } from '../../utils/audio/practiceVolume';
import type { SongKey, TunerKey, TunerReading } from '../../hooks/usePitchTuner';
import { describeSemitones, keyName, parseKey, tonicMidiNear } from '../../utils/pitch/music';
import { markSounding, playKeyReference } from '../../utils/audio/synth';
import { playChordByName } from '../../utils/chords/songChords';
import { DEFAULT_INSTRUMENT_ID, INSTRUMENTS } from '../../utils/chords/instruments';
import { monoFont } from '../../theme/createAppTheme';

type Props = {
  listening: boolean;
  reading: TunerReading | null;
  keyState: TunerKey;
  accuracy: { inTune: number; notes: number } | null;
  /** Tom atual da cifra, ex.: "G" (para dizer o tom sugerido). */
  currentKey: string | null;
  songKey: SongKey | null;
  voiceCenter: number | null;
  /** Acordes da música na ordem da cifra. */
  songChords: string[];
  onShiftKey: (semitones: number) => void;
};

const colorFor = (t: Theme, cents: number) => {
  const a = Math.abs(cents);
  return a <= 15 ? t.palette.success.main : a <= 30 ? t.palette.warning.main : t.palette.error.main;
};

/** Afinador (nota + ponteiro), tom da música e acordes para tocar junto. */
export function TunerPanel({
  listening, reading, keyState, accuracy, currentKey, songKey, voiceCenter, songChords, onShiftKey,
}: Props) {
  const cents = reading?.cents ?? 0;
  const needle = 50 + Math.max(-50, Math.min(50, cents));

  let status: React.ReactNode;
  if (!listening) status = 'ligando…';
  else if (!reading) status = 'cante uma nota';
  else if (Math.abs(cents) <= 15) status = 'afinado';
  else status = `${cents > 0 ? '+' : ''}${cents}¢`;

  return (
    <Paper elevation={3} sx={{ px: 1.5, py: 1, borderRadius: 2, width: 320, maxWidth: '100%', pointerEvents: 'auto' }}>
      {/* Nota cantada + ponteiro */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ minWidth: 46, textAlign: 'center', lineHeight: 1 }}>
          <Typography component='span' sx={{ fontSize: 22, fontWeight: 700, color: reading ? 'text.primary' : 'text.disabled' }}>
            {reading ? reading.note : '–'}
          </Typography>
          {reading && (
            <Typography component='span' sx={{ fontSize: 11, color: 'text.secondary', ml: 0.25 }}>{reading.octave}</Typography>
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Box
            role='meter'
            aria-label='afinação'
            aria-valuemin={-50}
            aria-valuemax={50}
            aria-valuenow={reading ? cents : undefined}
            sx={(t) => ({
              position: 'relative',
              height: 10,
              borderRadius: 5,
              background: `linear-gradient(90deg, ${alpha(t.palette.error.main, 0.25)}, ${alpha(t.palette.warning.main, 0.25)} 30%, ${alpha(t.palette.success.main, 0.35)} 42%, ${alpha(t.palette.success.main, 0.35)} 58%, ${alpha(t.palette.warning.main, 0.25)} 70%, ${alpha(t.palette.error.main, 0.25)})`,
            })}
          >
            <Box sx={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: '1px', bgcolor: 'text.secondary', opacity: 0.6 }} />
            {reading && (
              <Box
                sx={(t) => ({
                  position: 'absolute',
                  top: -3,
                  left: `${needle}%`,
                  width: 6,
                  height: 16,
                  ml: '-3px',
                  borderRadius: 3,
                  bgcolor: colorFor(t, cents),
                  boxShadow: 1,
                  transition: 'left 100ms linear',
                })}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>baixo</Typography>
            <Typography sx={(t) => ({ fontSize: 10, fontWeight: 600, color: reading ? colorFor(t, cents) : 'text.secondary' })}>
              {status}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>alto</Typography>
          </Box>
        </Box>
      </Box>

      {/* Tom */}
      <Box sx={{ mt: 0.75 }}>
        <KeyStatus keyState={keyState} currentKey={currentKey} onShiftKey={onShiftKey} />
        {accuracy && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
            {Math.round(accuracy.inTune * 100)}% das últimas {accuracy.notes} notas afinadas
          </Typography>
        )}
      </Box>

      {/* Acordes da música para tocar junto */}
      {(songChords.length > 0 || songKey) && (
        <>
          <Divider sx={{ my: 0.75 }} />
          <ChordPlayer
            chords={songChords}
            onGiveKey={songKey ? () => playKeyReference(tonicMidiNear(songKey.tonic, voiceCenter), songKey.minor) : null}
          />
        </>
      )}
    </Paper>
  );
}

const INSTRUMENT_KEY = 'practice-instrument';

function readInstrument(): string {
  try {
    const v = window.localStorage.getItem(INSTRUMENT_KEY);
    if (v && INSTRUMENTS.some((i) => i.id === v)) return v;
  } catch { }
  return DEFAULT_INSTRUMENT_ID;
}

/**
 * Faixa com os acordes na ordem da música. Tocar num acorde faz soar; "Próximo" toca o seguinte.
 * Assim dá para cantar a música inteira só com o celular, avançando acorde por acorde.
 */
function ChordPlayer({ chords, onGiveKey }: { chords: string[]; onGiveKey: (() => void) | null }) {
  const [instrumentId, setInstrumentId] = React.useState(readInstrument);
  const [pos, setPos] = React.useState(-1); // último acorde tocado
  const stripRef = React.useRef<HTMLDivElement>(null);

  // Outra música (outra quantidade de acordes): volta ao começo. Mudar o tom mantém a posição.
  const [prevCount, setPrevCount] = React.useState(chords.length);
  if (prevCount !== chords.length) {
    setPrevCount(chords.length);
    setPos(-1);
  }

  // Mantém o acorde atual visível no meio da faixa.
  React.useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>(`[data-idx="${pos}"]`);
    if (!strip || !chip) return;
    strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
  }, [pos]);

  const play = (i: number) => {
    if (playChordByName(chords[i], instrumentId)) markSounding(2500);
    setPos(i);
  };
  const next = pos + 1 < chords.length ? pos + 1 : 0;

  const changeInstrument = (id: string) => {
    setInstrumentId(id);
    try { window.localStorage.setItem(INSTRUMENT_KEY, id); } catch { }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <VolumeControl />
        {chords.length > 0 && (
          <Select
            size='small'
            variant='standard'
            disableUnderline
            value={instrumentId}
            onChange={(e) => changeInstrument(e.target.value)}
            inputProps={{ 'aria-label': 'instrumento' }}
            MenuProps={{ disablePortal: true }}
            sx={{ fontSize: 11, '& .MuiSelect-select': { py: 0 } }}
          >
            {INSTRUMENTS.map((inst) => (
              <MenuItem key={inst.id} value={inst.id} sx={{ fontSize: 13 }}>{inst.name}</MenuItem>
            ))}
          </Select>
        )}
        {onGiveKey && (
          <Button
            size='small'
            startIcon={<VolumeUpRoundedIcon sx={{ fontSize: '16px !important' }} />}
            onClick={onGiveKey}
            sx={{ py: 0, px: 0.75, fontSize: 11, minWidth: 0, flexShrink: 0 }}
          >
            Dar o tom
          </Button>
        )}
      </Box>

      {chords.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Esta cifra não tem acordes.</Typography>
      ) : (
        <>
          <Box
            ref={stripRef}
            role='list'
            aria-label='acordes da música'
            sx={{
              display: 'flex',
              gap: 0.5,
              overflowX: 'auto',
              pb: 0.5,
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {chords.map((c, i) => {
              const active = i === pos;
              return (
                <ButtonBase
                  key={i}
                  data-idx={i}
                  role='listitem'
                  onClick={() => play(i)}
                  aria-label={`tocar ${c}`}
                  aria-current={active || undefined}
                  sx={[{ color: active ? 'primary.contrastText' : 'chord.main' }, (t) => ({
                    flexShrink: 0,
                    minWidth: 40,
                    height: 34,
                    px: 1,
                    borderRadius: 1,
                    ...monoFont,
                    fontSize: 13,
                    fontWeight: 700,
                    bgcolor: active ? t.palette.primary.main : alpha(t.palette.text.primary, 0.06),
                    outline: i === next && !active ? `1px dashed ${alpha(t.palette.primary.main, 0.6)}` : 'none',
                    outlineOffset: -1,
                    transition: 'background-color 120ms',
                    '&:hover': { bgcolor: active ? t.palette.primary.dark : alpha(t.palette.text.primary, 0.12) },
                  })]}
                >
                  {c}
                </ButtonBase>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
            <IconButton
              size='small'
              aria-label='voltar ao primeiro acorde'
              onClick={() => setPos(-1)}
              disabled={pos < 0}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}
            >
              <ReplayRoundedIcon fontSize='small' />
            </IconButton>
            <Button
              fullWidth
              variant='contained'
              startIcon={<SkipNextRoundedIcon />}
              onClick={() => play(next)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {pos < 0 ? 'Começar' : 'Próximo'}: <Box component='span' sx={{ ...monoFont, ml: 0.75 }}>{chords[next]}</Box>
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}

/** Volume dos acordes e do "dar o tom" (independe do volume do celular). */
function VolumeControl() {
  const volume = React.useSyncExternalStore(subscribePracticeVolume, getPracticeVolume, () => 0.6);
  const muted = volume === 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0, pr: 1 }}>
      <IconButton
        size='small'
        aria-label={muted ? 'ligar som' : 'silenciar'}
        onClick={() => setPracticeVolume(muted ? 0.6 : 0)}
        sx={{ p: 0.25 }}
      >
        {muted ? <VolumeOffRoundedIcon sx={{ fontSize: 18 }} /> : <VolumeDownRoundedIcon sx={{ fontSize: 18 }} />}
      </IconButton>
      <Slider
        size='small'
        aria-label='volume dos sons'
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(_, v) => setPracticeVolume(v as number)}
        sx={{ py: 1 }}
      />
    </Box>
  );
}

function KeyStatus({ keyState, currentKey, onShiftKey }: Pick<Props, 'keyState' | 'currentKey' | 'onShiftKey'>) {
  const key = parseKey(currentKey);

  if (keyState.status === 'analyzing') {
    return (
      <Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Descobrindo em que tom você canta…</Typography>
        <LinearProgress variant='determinate' value={Math.min(100, keyState.progress * 100)} sx={{ mt: 0.5, height: 3, borderRadius: 2 }} />
      </Box>
    );
  }
  if (keyState.status === 'no-reference') {
    return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>A cifra não tem acordes para comparar o tom.</Typography>;
  }
  if (keyState.status === 'unsure') {
    return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Ainda não deu para ter certeza do tom. Continue cantando…</Typography>;
  }
  if (keyState.status === 'in-key') {
    return (
      <Typography sx={{ fontSize: 12, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <CheckCircleRoundedIcon sx={{ fontSize: 15 }} /> No tom da cifra{currentKey ? ` (${currentKey})` : ''}
      </Typography>
    );
  }

  const n = keyState.semitones;
  const target = key ? keyName(key.tonic + n, key.minor) : null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 12, flex: 1 }}>
        Você está cantando <b>{describeSemitones(n)} {n > 0 ? 'acima' : 'abaixo'}</b>
        {target ? <> (em <b>{target}</b>)</> : null}
      </Typography>
      <Button size='small' variant='contained' onClick={() => onShiftKey(n)} sx={{ flexShrink: 0, py: 0.25 }}>
        Ajustar
      </Button>
    </Box>
  );
}
