import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { alpha, keyframes, type Theme } from '@mui/material/styles';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import VolumeDownRoundedIcon from '@mui/icons-material/VolumeDownRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import Slider from '@mui/material/Slider';
import useMediaQuery from '@mui/material/useMediaQuery';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { MAX_BPM, MIN_BPM, usePlayAlong } from '../../hooks/usePlayAlong';
import { RHYTHMS } from '../../utils/chords/rhythms';
import { getPracticeVolume, setPracticeVolume, subscribePracticeVolume } from '../../utils/audio/practiceVolume';
import type { SongKey, TunerReading } from '../../hooks/usePitchTuner';
import { tonicMidiNear } from '../../utils/pitch/music';
import { markSounding, playKeyReference } from '../../utils/audio/synth';
import { playChordByName } from '../../utils/chords/songChords';
import { BAND_PARTS, type BandPart, type BandPartId, type PercId } from '../../utils/chords/band';
import { monoFont } from '../../theme/createAppTheme';

type Props = {
  listening: boolean;
  reading: TunerReading | null;
  accuracy: { inTune: number; notes: number } | null;
  songKey: SongKey | null;
  voiceCenter: number | null;
  /** Acordes da música na ordem da cifra. */
  songChords: string[];
};

/** Virada pedida: o botão pisca até ela entrar. */
const pulse = keyframes`
  from { opacity: 1; }
  to { opacity: 0.55; }
`;

const colorFor = (t: Theme, cents: number) => {
  const a = Math.abs(cents);
  return a <= 15 ? t.palette.success.main : a <= 30 ? t.palette.warning.main : t.palette.error.main;
};

/** Afinador (nota + ponteiro), quanto está afinado e acordes para tocar junto. */
export function TunerPanel({
  listening, reading, accuracy, songKey, voiceCenter, songChords,
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

      {/* Quanto do que foi cantado ficou afinado */}
      {accuracy && (
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.75 }}>
          {Math.round(accuracy.inTune * 100)}% das últimas {accuracy.notes} notas afinadas
        </Typography>
      )}

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

/**
 * Faixa com os acordes na ordem da música. Tocar num acorde faz soar; "Próximo" toca o seguinte.
 * Assim dá para cantar a música inteira só com o celular, avançando acorde por acorde.
 * Com o metrônomo ligado, a banda escolhida toca o acorde atual no ritmo e as trocas entram no tempo certo.
 */
function ChordPlayer({ chords, onGiveKey }: { chords: string[]; onGiveKey: (() => void) | null }) {
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

  const playAlong = usePlayAlong({ chords, pos, setPos });
  // Banda parada: tocar num acorde soa no instrumento de acorde principal da banda.
  const play = (i: number, reverse = false) => {
    if (playChordByName(chords[i], playAlong.lead.instrumentId!, { reverse })) markSounding(2500);
    setPos(i);
  };
  // Com o metrônomo ligado, a troca entra no tempo certo; parado, toca na hora.
  const go = (i: number) => { if (!playAlong.request(i)) play(i); };
  const wrapNext = (i: number) => (i + 1 < chords.length ? i + 1 : 0);
  const next = wrapNext(playAlong.queued ?? pos);

  // Teclado (desktop): ← → trocam de acorde e já tocam; ↑ toca a batida normal e ↓ a batida ao contrário.
  React.useEffect(() => {
    if (chords.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="slider"], [role="menu"], [role="listbox"]')) return;
      const base = playAlong.current() ?? pos;
      const strum = (reverse: boolean) => { if (!playAlong.manualStrum(reverse)) play(Math.max(pos, 0), reverse); };
      switch (e.key) {
        // Segurar a tecla não repete (nem dispara pelos acordes tocando todos).
        case 'ArrowRight': if (!e.repeat) go(wrapNext(base)); break;
        case 'ArrowLeft': if (!e.repeat) go(Math.max(base - 1, 0)); break;
        case 'ArrowUp': if (!e.repeat) strum(false); break;
        case 'ArrowDown': if (!e.repeat) strum(true); break;
        // Espaço pede a virada; com a banda parada, o espaço continua rolando a página.
        case ' ': if (!playAlong.running) return; if (!e.repeat) playAlong.requestFill(); break;
        default: return;
      }
      // Não rola a página, não abre o seletor de instrumento focado e não pausa a rolagem automática.
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  });
  const showKeyHint = useMediaQuery('(hover: hover) and (pointer: fine)');

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <VolumeControl />
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
          <PlayAlongBar playAlong={playAlong} />

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
              const isQueued = i === playAlong.queued;
              return (
                <ButtonBase
                  key={i}
                  data-idx={i}
                  role='listitem'
                  onClick={() => go(i)}
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
                    // Pedido na fila (entra no próximo tempo) em destaque; o próximo da música, tracejado.
                    outline: isQueued
                      ? `2px solid ${t.palette.primary.main}`
                      : i === next && !active ? `1px dashed ${alpha(t.palette.primary.main, 0.6)}` : 'none',
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
              onClick={() => (playAlong.running ? go(0) : setPos(-1))}
              disabled={pos < 0 && !playAlong.running}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}
            >
              <ReplayRoundedIcon fontSize='small' />
            </IconButton>
            {playAlong.running && playAlong.hasFill && (
              <Button
                variant={playAlong.fill === 'idle' ? 'outlined' : 'contained'}
                color={playAlong.fill === 'idle' ? 'inherit' : 'secondary'}
                onClick={playAlong.requestFill}
                aria-label={showKeyHint ? 'virada (espaço)' : 'virada'}
                sx={[
                  { textTransform: 'none', fontWeight: 600, minWidth: 0, px: 1.25, flexShrink: 0, borderColor: 'divider' },
                  playAlong.fill === 'queued' && { animation: `${pulse} 0.6s ease-in-out infinite alternate` },
                ]}
              >
                Virada
              </Button>
            )}
            <Button
              fullWidth
              variant='contained'
              startIcon={<SkipNextRoundedIcon />}
              onClick={() => go(next)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {pos < 0 ? 'Começar' : 'Próximo'}: <Box component='span' sx={{ ...monoFont, ml: 0.75 }}>{chords[next]}</Box>
            </Button>
          </Box>
          {showKeyHint && (
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
              ← → trocar acorde · ↑ ↓ tocar{playAlong.running && playAlong.hasFill ? ' · espaço: virada' : ''}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

/** Metrônomo do "tocar junto": liga/desliga, andamento, tap, ritmo, clique e banda. */
function PlayAlongBar({ playAlong: p }: { playAlong: ReturnType<typeof usePlayAlong> }) {
  const small = { fontSize: 11, '& .MuiSelect-select': { py: 0 } };
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          size='small'
          color='primary'
          aria-label={p.running ? 'parar o metrônomo' : 'tocar junto com metrônomo'}
          onClick={p.running ? p.stop : p.start}
          sx={(t) => ({ bgcolor: alpha(t.palette.primary.main, 0.14), '&:hover': { bgcolor: alpha(t.palette.primary.main, 0.24) } })}
        >
          {p.running ? <StopRoundedIcon fontSize='small' /> : <PlayArrowRoundedIcon fontSize='small' />}
        </IconButton>

        <IconButton size='small' aria-label='mais devagar' onClick={() => p.setBpm(p.bpm - 4)} disabled={p.bpm <= MIN_BPM} sx={{ p: 0.25 }}>
          <RemoveRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Typography sx={{ ...monoFont, fontSize: 12, fontWeight: 700, minWidth: 52, textAlign: 'center' }}>
          {p.bpm} <Box component='span' sx={{ fontWeight: 400, color: 'text.secondary', fontSize: 10 }}>bpm</Box>
        </Typography>
        <IconButton size='small' aria-label='mais rápido' onClick={() => p.setBpm(p.bpm + 4)} disabled={p.bpm >= MAX_BPM} sx={{ p: 0.25 }}>
          <AddRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Button
          size='small'
          onClick={p.tap}
          aria-label='marcar o andamento tocando no ritmo'
          sx={{ py: 0, px: 0.75, minWidth: 0, fontSize: 11, textTransform: 'none' }}
        >
          Tap
        </Button>

        <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          {Array.from({ length: p.beatsPerBar }, (_, i) => (
            <Box
              key={i}
              sx={(t) => ({
                width: i === 0 ? 9 : 7,
                height: i === 0 ? 9 : 7,
                borderRadius: '50%',
                bgcolor: i === p.beat
                  ? (p.countingIn ? t.palette.warning.main : t.palette.primary.main)
                  : alpha(t.palette.text.primary, 0.15),
              })}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
        <Select
          size='small'
          variant='standard'
          disableUnderline
          value={p.rhythm.id}
          onChange={(e) => p.setRhythmId(e.target.value)}
          renderValue={() => `Ritmo: ${p.rhythm.name}`}
          inputProps={{ 'aria-label': 'ritmo' }}
          MenuProps={{ slotProps: { paper: { sx: { maxHeight: 360 } } } }}
          sx={small}
        >
          {RHYTHMS.map((r) => (
            <MenuItem key={r.id} value={r.id} sx={{ display: 'block', py: 0.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{r.name}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.hint}</Typography>
            </MenuItem>
          ))}
        </Select>
        {p.countingIn ? (
          <Typography sx={{ fontSize: 11, color: 'warning.main', ml: 'auto' }}>contando…</Typography>
        ) : (
          p.rhythm.id !== 'click' && (
            <Button
              size='small'
              aria-pressed={p.clickOn}
              onClick={() => p.setClickOn(!p.clickOn)}
              sx={{ ml: 'auto', py: 0, px: 0.75, minWidth: 0, fontSize: 11, textTransform: 'none', color: p.clickOn ? 'primary.main' : 'text.secondary' }}
            >
              {p.clickOn ? 'Clique ligado' : 'Clique desligado'}
            </Button>
          )
        )}
      </Box>

      {/* Banda: quem toca junto. Bateria e percussão aparecem só nos ritmos que as usam. */}
      <BandChips
        label='instrumentos da banda'
        parts={BAND_PARTS.filter((part) => part.role !== 'perc' && (part.role !== 'drums' || !!p.rhythm.drums))}
        band={p.band}
        onToggle={p.togglePart}
      />
      {p.rhythm.perc && (
        <BandChips
          label='percussão'
          title='Percussão'
          parts={BAND_PARTS.filter((part) => part.role === 'perc' && !!p.rhythm.perc?.[part.id as PercId])}
          band={p.band}
          onToggle={p.togglePart}
        />
      )}
      {/* Crédito exigido pela licença CC BY dos sons gravados (detalhes em /samples/CREDITS.md). */}
      <Typography
        component='a'
        href='/samples/CREDITS.md'
        target='_blank'
        rel='noopener'
        sx={{ display: 'block', mt: 0.5, fontSize: 9, color: 'text.disabled', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
      >
        Sons: FluidR3 GM de Frank Wen (CC BY 3.0) e VCSL (CC0)
      </Typography>
    </Box>
  );
}

/** Botões de ligar/desligar instrumentos da banda. */
function BandChips({ label, title, parts, band, onToggle }: {
  label: string;
  title?: string;
  parts: BandPart[];
  band: BandPartId[];
  onToggle: (id: BandPartId) => void;
}) {
  return (
    <Box role='group' aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
      {title && <Typography sx={{ fontSize: 10, color: 'text.secondary', mr: 0.25 }}>{title}:</Typography>}
      {parts.map((part) => {
        const on = band.includes(part.id);
        return (
          <ButtonBase
            key={part.id}
            aria-pressed={on}
            onClick={() => onToggle(part.id)}
            sx={(t) => ({
              px: 0.75,
              height: 22,
              borderRadius: 11,
              fontSize: 11,
              fontWeight: on ? 600 : 400,
              color: on ? t.palette.primary.main : t.palette.text.secondary,
              bgcolor: on ? alpha(t.palette.primary.main, 0.16) : 'transparent',
              border: 1,
              borderColor: on ? alpha(t.palette.primary.main, 0.5) : t.palette.divider,
            })}
          >
            {part.name}
          </ButtonBase>
        );
      })}
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
