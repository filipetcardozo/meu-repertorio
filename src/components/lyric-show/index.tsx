/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { createPortal } from 'react-dom';
import { Markup } from 'interweave';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import { displayFontFamily, monoFont } from '../../theme/createAppTheme';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import { UpdateFromCifraClubButton } from './UpdateFromCifraClub';
import { ImproveCifraWithAiButton } from './ImproveCifraWithAi';
import { ArtistAvatar } from '../ArtistAvatar';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import { simplifyChordSheet } from '../../utils/simplifyChordSheet';
import { decorateSectionTitles } from '../../utils/sectionTitles';
import { chordSheetMarksSx } from './chordSheetStyles';
import { setLyricCompactView } from '../../providers/lyrics/services';
import { useRouter } from 'next/router';
import { lyricHasTabs, useLyricShow } from '../../hooks/useLyricShow';
import { writeTone } from '../../utils/writeTone';
import { Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { wrapChordSheetHtml } from '../../utils/wrapChordSheet';
import { countLines, splitChordColumns } from '../../utils/splitChordColumns';
import { useLyricFollow } from '../../hooks/useLyricFollow';
import { CurrentLineHighlight, FollowControls } from './FollowControls';
import { TunerPanel } from './TunerPanel';
import { KeyControl } from './KeyControl';
import { usePitchTuner } from '../../hooks/usePitchTuner';
import { ChordDiagramCards, ChordDiagramCardsHandle } from '../chord-diagram/ChordDiagramCards';
import { chordAtPoint } from '../../utils/chords/chordAtPoint';
import { useLyricDisplayPrefs } from '../../hooks/useLyricDisplayPrefs';
import { DisplaySettingsButton } from './DisplaySettings';
import { useAuth } from '../../hooks/useAuth';
import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { PlaybackBar, PlaybackButton, PlaybackManagerDialog } from './Playback';

const SHOW_TABS_KEY = 'lyricShowTabs';

export const LyricShowComponent = ({
  changeOffSet,
  handleNext,
  lyricToShow,
  nextLyricToShow,
  offsetsUpdateds,
  updateOffset,
  offsetIsUpdating,
  offsetLyricToShow,
  isOneLyric,
  offsetChanged,
  mobileControlsContainer,
  columnHeight,
}: any) => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  // Fonte e espaçamentos da cifra: cada tipo de aparelho tem os seus, salvos no perfil.
  const display = useLyricDisplayPrefs(isMobile ? 'mobile' : 'desktop');
  const { fontSize, lineHeight, letterSpacing, columnGap } = display.prefs;
  const lineHeightPx = Math.round(fontSize * lineHeight);

  // Tablaturas: ligadas por padrão; a escolha fica salva no aparelho.
  const [showTabs, setShowTabs] = React.useState<boolean>(() => {
    try { return window.localStorage.getItem(SHOW_TABS_KEY) !== '0'; } catch { return true; }
  });
  const toggleTabs = React.useCallback(() => {
    setShowTabs((v) => {
      try { window.localStorage.setItem(SHOW_TABS_KEY, v ? '0' : '1'); } catch { /* sem storage */ }
      return !v;
    });
  }, []);
  const hasTabs = lyricHasTabs(lyricToShow?.lyric);

  // Modo compacto (resume repetições): escolha por música, salva na própria música.
  // O resumo é calculado aqui; a cifra salva continua completa.
  const [compactById, setCompactById] = React.useState<Record<string, boolean>>({});
  const compactCurrent = React.useMemo(() => simplifyChordSheet(lyricToShow?.lyric), [lyricToShow?.lyric]);
  const compactNext = React.useMemo(() => simplifyChordSheet(nextLyricToShow?.lyric), [nextLyricToShow?.lyric]);
  const canCompact = compactCurrent.changed;
  const compactOn = canCompact && (compactById[lyricToShow?.lyricId] ?? !!lyricToShow?.compactView);
  const nextCompactOn =
    !!nextLyricToShow && compactNext.changed && (compactById[nextLyricToShow.lyricId] ?? !!nextLyricToShow.compactView);
  // Títulos de seção viram rótulos destacados (só na exibição)
  const shownLyric = React.useMemo(
    () =>
      lyricToShow
        ? { ...lyricToShow, lyric: decorateSectionTitles(compactOn ? compactCurrent.html : lyricToShow.lyric) }
        : lyricToShow,
    [compactOn, lyricToShow, compactCurrent],
  );
  const shownNextLyric = React.useMemo(
    () =>
      nextLyricToShow
        ? { ...nextLyricToShow, lyric: decorateSectionTitles(nextCompactOn ? compactNext.html : nextLyricToShow.lyric) }
        : nextLyricToShow,
    [nextCompactOn, nextLyricToShow, compactNext],
  );
  const toggleCompact = () => {
    const id = lyricToShow?.lyricId;
    if (!id) return;
    const next = !compactOn;
    setCompactById((prev) => ({ ...prev, [id]: next }));
    setLyricCompactView(id, next);
  };

  // A cifra vem inteira; a divisão em colunas (desktop/tablet) é feita aqui, conforme o espaço.
  const {
    htmlLyric,
    htmlLyricNextMusic,
  } = useLyricShow({
    lyricToShow: shownLyric,
    offsetLyricToShow,
    nextLyricToShow: shownNextLyric,
    singleColumn: true,
    showTabs,
  });

  // Quantos caracteres monoespaçados cabem na largura disponível.
  const mobileRootRef = React.useRef<HTMLDivElement>(null);
  const [maxCols, setMaxCols] = React.useState<number>(Infinity);

  // Rolagem automática + seguir a voz
  const follow = useLyricFollow(lyricToShow?.lyricId ?? '');
  const { rootRef: setFollowRoot } = follow;
  const setContentRoot = React.useCallback((el: HTMLDivElement | null) => {
    mobileRootRef.current = el;
    setFollowRoot(el);
  }, [setFollowRoot]);

  // Playback (mp3) sincronizado com a cifra
  const { uid } = useAuth();
  const playback = usePlaybackSync({
    lyricId: lyricToShow?.lyricId ?? '',
    uid,
    external: follow.external,
    onNext: nextLyricToShow ? handleNext : undefined,
    keyOffset: offsetLyricToShow ?? 0,
  });
  const [playbackManagerOpen, setPlaybackManagerOpen] = React.useState(false);

  // Afinador + detecção de tom
  const currentKey = writeTone(lyricToShow);
  const tuner = usePitchTuner({ root: follow.root, currentKey, lyricKey: lyricToShow?.lyricId ?? '' });

  // Clique num acorde abre um card com o desenho dele; nos outros lugares segue o comportamento normal.
  const chordCardsRef = React.useRef<ChordDiagramCardsHandle>(null);
  const { handleLyricClick } = follow;
  const handleBodyClick = React.useCallback((e: React.MouseEvent) => {
    const chord = chordAtPoint(e.target, e.clientX, e.clientY);
    if (chord) {
      chordCardsRef.current?.open(chord.name, chord.rect);
      return;
    }
    handleLyricClick(e);
  }, [handleLyricClick]);

  // Com mouse (não em tela de toque): parar em cima do acorde abre uma prévia.
  const handleBodyMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const chord = chordAtPoint(e.target, e.clientX, e.clientY);
    if (chord) chordCardsRef.current?.hoverChord(chord.name, chord.rect);
    else chordCardsRef.current?.leaveChord();
  }, []);
  const handleBodyMouseLeave = React.useCallback(() => chordCardsRef.current?.leaveChord(), []);

  React.useLayoutEffect(() => {
    const root = mobileRootRef.current;
    if (!root) return;

    const measure = () => {
      const pre = document.createElement('pre');
      pre.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;margin:0;';
      const probe = document.createElement('span');
      probe.textContent = '0'.repeat(50);
      pre.appendChild(probe);
      root.appendChild(pre);
      const charWidth = probe.getBoundingClientRect().width / 50;
      root.removeChild(pre);

      const style = window.getComputedStyle(root);
      const available = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (charWidth > 0 && available > 0) {
        const cols = Math.floor(available / charWidth);
        setMaxCols((prev) => (prev === cols ? prev : cols));
      }
    };

    measure();
    // A fonte da cifra carrega com "swap": mede de novo quando ela chega, senão a largura do caractere é a da fonte reserva.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => { alive = false; observer.disconnect(); };
  }, [isMobile, fontSize, letterSpacing]);

  // Ao chegar na última música, o HTML da "próxima" ainda é o da troca anterior por um render
  // (useLyricShow só limpa no efeito). Sem música seguinte, não há o que mostrar.
  const hasNextMusic = !!nextLyricToShow && !!htmlLyricNextMusic;

  // Desktop/tablet: colunas lado a lado só quando TODAS cabem inteiras na largura.
  // Nível 0 = colunas + prévia da próxima música como coluna; 1 = colunas sem a prévia;
  // 2 = uma coluna só, com quebra de linha e a prévia embaixo (como no celular).
  // Cada nível é renderizado e medido antes de pintar a tela (useLayoutEffect), então não pisca.
  const linesPerColumn = Math.max(
    10,
    Math.floor(((columnHeight ?? (typeof window !== 'undefined' ? window.innerHeight - 100 : 700)) - 60) / lineHeightPx),
  );
  const fitKey = `${htmlLyric ?? ''}|${hasNextMusic ? htmlLyricNextMusic : ''}|${linesPerColumn}`;
  const [fit, setFit] = React.useState<{ key: string; cols: number; level: number }>({ key: '', cols: 0, level: 0 });
  // A decisão continua valendo enquanto a largura não crescer de verdade: a barra de rolagem da página
  // aparece/some conforme o layout (estreita ~2 caracteres) e não pode ficar alternando o layout (pisca-pisca).
  // Se a largura diminuir, o efeito abaixo mede de novo e sobe de nível se preciso.
  const FIT_TOLERANCE_COLS = 3;
  const fitLevel = fit.key === fitKey && maxCols <= fit.cols + FIT_TOLERANCE_COLS ? fit.level : 0;
  const stacked = isMobile || fitLevel >= 2;
  const columnsRowRef = React.useRef<HTMLDivElement>(null);

  const lyricHtml = React.useMemo(
    () => (stacked ? wrapChordSheetHtml(htmlLyric, maxCols) : htmlLyric),
    [stacked, htmlLyric, maxCols],
  );
  // A prévia vai embaixo (largura toda, com quebra) quando não cabe como coluna ao lado.
  const nextBelow = stacked || fitLevel === 1;
  const nextMusicHtml = React.useMemo(
    () => (nextBelow ? wrapChordSheetHtml(htmlLyricNextMusic, maxCols) : htmlLyricNextMusic),
    [nextBelow, htmlLyricNextMusic, maxCols],
  );
  const columns = React.useMemo(
    () => (stacked ? (lyricHtml ? [lyricHtml] : []) : splitChordColumns(htmlLyric, linesPerColumn)),
    [stacked, lyricHtml, htmlLyric, linesPerColumn],
  );
  // Prévia da próxima (nível 0): embaixo da última coluna se ela for curta; senão, numa coluna própria.
  const nextInLastColumn = stacked || (columns.length > 1 && countLines(columns[columns.length - 1]) < 20);
  const showNextInColumns = hasNextMusic && (stacked || fitLevel === 0);
  // Nível 1: as colunas cabem, a prévia não — ela vai para baixo delas, como no celular.
  const showNextBelowColumns = hasNextMusic && !stacked && fitLevel === 1;

  React.useLayoutEffect(() => {
    if (isMobile || fitLevel >= 2 || !Number.isFinite(maxCols)) return;
    const row = columnsRowRef.current;
    if (!row) return;
    const limit = row.getBoundingClientRect().right + 1;
    const overflows = Array.from(row.children).some((el) => el.getBoundingClientRect().right > limit);
    if (overflows) setFit({ key: fitKey, cols: maxCols, level: fitLevel + 1 });
  });

  function EditLyricButton() {
    return (
      <Tooltip title='Editar música'>
        <IconButton
          aria-label='editar música'
          onClick={() => router.push(`/lyric/manage-lyric/${lyricToShow.lyricId}`)}
          color='inherit'
          size={isMobile ? 'small' : 'medium'}
        >
          <EditIcon color='primary' fontSize={isMobile ? 'small' : 'medium'} />
        </IconButton>
      </Tooltip>
    );
  }

  function CompactToggleButton() {
    if (!canCompact) return null;
    return (
      <Tooltip title={compactOn ? 'Mostrar a cifra completa' : 'Modo compacto: resumir repetições'}>
        <IconButton
          aria-label={compactOn ? 'mostrar cifra completa' : 'resumir repetições'}
          aria-pressed={compactOn}
          onClick={toggleCompact}
          size={isMobile ? 'small' : 'medium'}
          color={compactOn ? 'primary' : 'default'}
        >
          {compactOn ? (
            <UnfoldLessRoundedIcon fontSize={isMobile ? 'small' : 'medium'} />
          ) : (
            <UnfoldMoreRoundedIcon fontSize={isMobile ? 'small' : 'medium'} />
          )}
        </IconButton>
      </Tooltip>
    );
  }

  function TabsToggleButton() {
    if (!hasTabs) return null;
    return (
      <Tooltip title={showTabs ? 'Esconder tablaturas' : 'Mostrar tablaturas'}>
        <IconButton
          aria-label={showTabs ? 'esconder tablaturas' : 'mostrar tablaturas'}
          aria-pressed={showTabs}
          onClick={toggleTabs}
          size={isMobile ? 'small' : 'medium'}
        >
          <Box
            component='span'
            sx={{
              px: 0.5,
              lineHeight: 1.4,
              fontSize: isMobile ? 10 : 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              borderRadius: 0.75,
              border: '1.5px solid',
              borderColor: showTabs ? 'primary.main' : 'text.disabled',
              color: showTabs ? 'primary.main' : 'text.disabled',
              textDecoration: showTabs ? 'none' : 'line-through',
            }}
          >
            TAB
          </Box>
        </IconButton>
      </Tooltip>
    );
  }

  function FontControls() {
    return (
      <DisplaySettingsButton
        device={isMobile ? 'mobile' : 'desktop'}
        prefs={display.prefs}
        onChange={display.update}
        onReset={display.reset}
        isDefault={display.isDefault}
        status={display.status}
        canSyncProfile={display.canSyncProfile}
        size={isMobile ? 'small' : 'medium'}
      />
    );
  }

  // No repertório (mobile) o nome da música já aparece na barra fixa do topo.
  const showTitle = !isMobile || isOneLyric;
  // No repertório (mobile) os controles vão para a barra fixa do topo, via portal.
  const controlsInHeader = isMobile && !!mobileControlsContainer;

  /** Título, tom, salvar tom, fonte (celular) e editar. */
  function Controls() {
    const offsetPendingSave = isOneLyric ? offsetChanged : offsetsUpdateds?.offsetChanged;

    return (
        <Stack
          sx={{
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            rowGap: 1,
            width: controlsInHeader || !isMobile ? '100%' : 'auto',
            mt: isMobile && !controlsInHeader ? 1 : 0,
            mb: isMobile && !controlsInHeader ? 1.5 : 0,
          }}
          direction='row'
          spacing={isMobile ? 1 : 2}
          useFlexGap
        >
          {showTitle && !isMobile && (
            <Stack direction='row' sx={{ alignItems: 'center', gap: 1, minWidth: 0 }}>
              <ArtistAvatar
                composerId={lyricToShow.composerId}
                image={lyricToShow.composerImage}
                name={lyricToShow.composerName}
                size={30}
              />
              <Typography sx={{ fontSize: 15, color: 'text.primary' }} variant='h6'>
                {lyricToShow.lyricName + ' '}
                <Box sx={{ fontSize: 11, color: 'text.secondary' }} component='span'>
                  ({lyricToShow.composerName})
                </Box>
              </Typography>
            </Stack>
          )}

          <KeyControl
            originalTone={lyricToShow.originalTone}
            currentKey={currentKey}
            offset={offsetLyricToShow ?? 0}
            onShift={changeOffSet}
            pendingSave={!!offsetPendingSave}
            saving={offsetIsUpdating}
            onSave={() => updateOffset()}
          />

          <Stack direction='row' sx={{ alignItems: 'center', ml: 'auto', flexShrink: 0 }}>
            {lyricToShow.lyricId ? (
              <PlaybackButton
                sync={playback}
                onManage={() => setPlaybackManagerOpen(true)}
                size={isMobile ? 'small' : 'medium'}
              />
            ) : null}
            {FontControls()}
            {CompactToggleButton()}
            {TabsToggleButton()}
            {lyricToShow.lyricId ? (
              <ImproveCifraWithAiButton
                lyricId={lyricToShow.lyricId}
                hasUnsavedOffset={!!offsetPendingSave}
                saveOffset={() => updateOffset()}
                size={isMobile ? 'small' : 'medium'}
              />
            ) : null}
            {lyricToShow.lyricId ? (
              <UpdateFromCifraClubButton
                lyricId={lyricToShow.lyricId}
                lyricName={lyricToShow.lyricName}
                composerName={lyricToShow.composerName}
                offset={offsetLyricToShow ?? 0}
                hasUnsavedOffset={!!offsetPendingSave}
                saveOffset={() => updateOffset()}
                size={isMobile ? 'small' : 'medium'}
              />
            ) : null}
            {EditLyricButton()}
          </Stack>
        </Stack>
    );
  }

  /** Celular: título (fora do repertório), controles e a cifra numa coluna só. */
  function FirstColumn() {
    if (!htmlLyric) return null;
    const controls = Controls();

    return (
      <Box sx={{ display: 'inline' }} className='lyric-show'>
        {showTitle && isMobile && (
          <Stack direction='row' sx={{ alignItems: 'center', gap: 1 }}>
            <ArtistAvatar
              composerId={lyricToShow.composerId}
              image={lyricToShow.composerImage}
              name={lyricToShow.composerName}
              size={30}
            />
            <Typography sx={{ fontSize: 16, fontWeight: 'bold', color: 'text.primary', fontFamily: 'inherit' }} variant='h6'>
              {lyricToShow.lyricName + ' '}
              <Box sx={{ fontSize: 12, fontWeight: 'normal', color: 'text.secondary' }} component='span'>
                ({lyricToShow.composerName})
              </Box>
            </Typography>
          </Stack>
        )}

        {controlsInHeader ? createPortal(controls, mobileControlsContainer) : controls}

        <div data-lyric-body>
          <Markup content={lyricHtml} />
        </div>
      </Box>
    );
  }

  function NextMusic() {
    if (!hasNextMusic) return null;
    return (
      <Box
        onClick={() => handleNext()}
        sx={[{ display: 'block', mt: nextBelow ? 3 : 0 }, (theme) => ({
          cursor: 'pointer',
          color: theme.palette.text.secondary,
          '&:hover': { color: theme.palette.text.primary },
        })]}
      >
        <Divider>
          <Stack direction='row' sx={{ alignItems: 'center', gap: 1 }}>
            <ArtistAvatar
              composerId={nextLyricToShow.composerId}
              image={nextLyricToShow.composerImage}
              name={nextLyricToShow.composerName}
              size={24}
            />
            <Typography sx={{ color: 'inherit', fontSize: 16 }} variant='h6'>
              {nextLyricToShow.lyricName}
            </Typography>
          </Stack>
        </Divider>
        <Markup content={nextMusicHtml} />
      </Box>
    );
  }

  function NextMusicFloatButton() {
    const nextName: string = nextLyricToShow?.lyricName ?? '';

    return (
      <Paper
        elevation={0}
        sx={(t) => ({
          position: 'fixed',
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          right: 16,
          zIndex: 'speedDial',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          // Até 300px para não encostar nos controles de rolagem (centralizados) em telas de ~900px.
          maxWidth: 300,
          pl: 0.75,
          pr: 0.75,
          py: 0.75,
          borderRadius: 999,
          border: `1px solid ${t.palette.divider}`,
          boxShadow: t.shadows[6],
          '@supports (backdrop-filter: blur(1px))': {
            backgroundColor: alpha(t.palette.background.paper, 0.78),
            backdropFilter: 'saturate(160%) blur(14px)',
          },
        })}
      >
        <ArtistAvatar
          composerId={nextLyricToShow?.composerId}
          image={nextLyricToShow?.composerImage}
          name={nextLyricToShow?.composerName}
          size={36}
        />
        <Box sx={{ minWidth: 0, ml: -0.5 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>Próxima</Typography>
          <Typography noWrap title={nextName} sx={{ fontFamily: displayFontFamily, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
            {nextName}
          </Typography>
        </Box>
        <Button
          variant='contained'
          onClick={() => handleNext()}
          endIcon={<SkipNextRoundedIcon />}
          aria-label={nextName ? `tocar a próxima: ${nextName}` : 'próxima música'}
          sx={{ flexShrink: 0 }}
        >
          Tocar
        </Button>
      </Paper>
    );
  }

  function Follow() {
    return (
      <FollowControls
        playing={follow.playing}
        onTogglePlay={follow.togglePlaying}
        speedLabel={follow.speedLabel}
        onFaster={follow.faster}
        onSlower={follow.slower}
        voice={follow.voice}
        hasCurrentLine={follow.currentLine != null}
        tuner={tuner}
        extraPanel={
          <PlaybackBar sync={playback} onManage={() => setPlaybackManagerOpen(true)} lyricHtml={lyricToShow?.lyric} />
        }
        tunerPanel={
          <TunerPanel
            listening={tuner.listening}
            reading={tuner.reading}
            accuracy={tuner.accuracy}
            songKey={tuner.songKey}
            voiceCenter={tuner.voiceCenter}
            songChords={tuner.songChords}
          />
        }
      />
    );
  }

  function PlaybackManager() {
    if (!lyricToShow?.lyricId) return null;
    return (
      <PlaybackManagerDialog
        open={playbackManagerOpen}
        onClose={() => setPlaybackManagerOpen(false)}
        sync={playback}
        lyricId={lyricToShow.lyricId}
        uid={uid}
        lyricHtml={lyricToShow.lyric}
      />
    );
  }

  // Espaço no fim da cifra para os painéis flutuantes não cobrirem as últimas linhas.
  const floatingPad = tuner.enabled ? 26 : playback.open ? 26 : null;

  if (isMobile) {
    return (
      <>
        <Box
          ref={setContentRoot}
          data-lyric-content
          onClick={handleBodyClick}
          onMouseMove={handleBodyMouseMove}
          onMouseLeave={handleBodyMouseLeave}
          sx={{
            display: 'block',
            position: 'relative',
            fontSize: `${fontSize}px`,
            lineHeight,
            letterSpacing: `${letterSpacing}em`,
            ...monoFont,
            color: 'text.primary',
            '& [data-lyric-body] b': { cursor: 'pointer' },
            '& b': { color: 'chord.main' },
            // Títulos de seção ([Refrão]…) e marcas do modo compacto (2×, repete)
            ...chordSheetMarksSx(theme),
            '& .tablatura': { color: 'text.secondary' },
            // A quebra de linha é feita por wrapChordSheetHtml (acorde + letra juntos).
            // Sem overflow no <pre>: "overflow-x: auto" também liga a rolagem no Y e qualquer 1px a mais
            // vira uma caixinha com barras de rolagem. O que sobrar fica cortado pela área da música.
            '& pre': {
              fontFamily: 'inherit',
              fontSize: 'inherit',
              m: 0,
              overflow: 'visible',
            },
            // espaço para os botões flutuantes não cobrirem as últimas linhas
            pb: floatingPad ?? 12,
          }}
        >
          <CurrentLineHighlight box={follow.highlight} />
          {FirstColumn()}
          {NextMusic()}
        </Box>

        {Follow()}
        {PlaybackManager()}
        <ChordDiagramCards ref={chordCardsRef} />
        {/* No celular a troca de música é pelo gesto de arrastar para o lado (no repertório). */}
      </>
    );
  }

  return (
    <>
      <Box
        ref={setContentRoot}
        data-lyric-content
        onClick={handleBodyClick}
        onMouseMove={handleBodyMouseMove}
        onMouseLeave={handleBodyMouseLeave}
        sx={{
          position: 'relative',
          display: 'block',
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeightPx}px`,
          letterSpacing: `${letterSpacing}em`,
          ...monoFont,
          color: 'text.primary',
          '& b': { color: 'chord.main' },
            // Títulos de seção ([Refrão]…) e marcas do modo compacto (2×, repete)
            ...chordSheetMarksSx(theme),
            '& .tablatura': { color: 'text.secondary' },
          '& [data-lyric-body] b': { cursor: 'pointer' },
          // Numa coluna só (não coube lado a lado), a quebra é feita por wrapChordSheetHtml.
          // Nunca rolagem própria no <pre> (ver comentário no layout do celular).
          '& pre': { overflow: 'visible' },
          // Espaço no fim para os botões flutuantes (rolagem/voz, "Próxima") não cobrirem as últimas linhas.
          pb: floatingPad ?? 10,
        }}
      >
        <CurrentLineHighlight box={follow.highlight} />
        {htmlLyric && Controls()}

        <Box
          ref={columnsRowRef}
          sx={{ display: 'flex', alignItems: 'flex-start', columnGap: `${columnGap}px` }}
        >
          {columns.map((html, i) => (
            <Box key={i} sx={stacked ? { flex: '1 1 auto', minWidth: 0 } : { flex: '0 0 auto' }}>
              <div data-lyric-body>
                <Markup content={html} />
              </div>
              {showNextInColumns && nextInLastColumn && i === columns.length - 1 && NextMusic()}
            </Box>
          ))}
          {showNextInColumns && !nextInLastColumn && (
            <Box sx={{ flex: '0 0 auto' }}>{NextMusic()}</Box>
          )}
        </Box>
        {showNextBelowColumns && NextMusic()}
      </Box>

      {Follow()}
      {PlaybackManager()}
      <ChordDiagramCards ref={chordCardsRef} />
      {hasNextMusic && NextMusicFloatButton()}
    </>
  );
};
