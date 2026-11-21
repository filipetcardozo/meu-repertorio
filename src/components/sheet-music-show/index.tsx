import { createRef, useEffect, useLayoutEffect, useRef } from 'react';
import React from 'react';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import Typography from '@mui/material/Typography';
import StepButton from '@mui/material/StepButton';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton';
import { useShowSheetMusic } from '../../hooks/useShowSheetMusic';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { SkeletonComponent } from './Skeleton';
import { LyricShowComponent } from '../lyric-show';
import { useRouter } from 'next/dist/client/router';
import { lyricInSheetMusicType } from '../../types/sheetMusicType';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme, Theme } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import ButtonBase from '@mui/material/ButtonBase';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Stack from '@mui/material/Stack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';
import HorizontalSplitOutlinedIcon from '@mui/icons-material/HorizontalSplitOutlined';
import { useAppBarHidden } from '../app-layout/AppBarVisibility';
import { requestHideBars } from '../../hooks/useHideOnScroll';
import { SetlistProgress } from './SetlistProgress';
import { displayFontFamily } from '../../theme/createAppTheme';
import { ArtistAvatar, PlayedBadge } from '../ArtistAvatar';

// Foto do artista no lugar do número da música; a linha entre as músicas fica no centro dela.
const STEP_AVATAR = 34;
const stepperSx = {
  '& .MuiStepConnector-root': { ml: `${STEP_AVATAR / 2}px` },
  '& .MuiStepLabel-iconContainer': { pr: 1.5 },
} as const;

// Posiciona um elemento "fixed" logo abaixo do AppBar, respeitando a altura do Toolbar em cada breakpoint.
// Quando o AppBar está escondido (scroll para baixo no mobile), sobe para o topo da tela.
const fixedBelowToolbar = (theme: Theme, appBarHidden: boolean) => {
  const transition = theme.transitions.create('top', {
    duration: appBarHidden ? theme.transitions.duration.leavingScreen : theme.transitions.duration.enteringScreen,
    easing: theme.transitions.easing.sharp,
  });
  if (appBarHidden) return { top: 0, transition };
  const toolbar = theme.mixins.toolbar as Record<string, any>;
  const style: Record<string, any> = { top: toolbar.minHeight, transition };
  Object.keys(toolbar).forEach((key) => {
    if (key.startsWith('@media')) style[key] = { top: toolbar[key].minHeight };
  });
  return style;
};

// Tablet/desktop: lista de músicas ao lado (coluna à esquerda) ou em cima (barra, como no celular).
type ListPosition = 'side' | 'top';
const LIST_POSITION_KEY = 'sheet-music-list-position';

function readListPosition(): ListPosition {
  try {
    if (window.localStorage.getItem(LIST_POSITION_KEY) === 'top') return 'top';
  } catch { }
  return 'side';
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  props,
  ref,
) {
  return <MuiAlert elevation={6} ref={ref} variant='filled' {...props} />;
});

// Tooltip que respeita o tema
const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[1],
    fontSize: 11,
  },
}));

export const SheetMusicShow = ({ sheetMusicId }: { sheetMusicId: string }) => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [songListOpen, setSongListOpen] = React.useState(false);
  const [listPosition, setListPosition] = React.useState<ListPosition>(readListPosition);
  const changeListPosition = (value: ListPosition) => {
    setListPosition(value);
    try { window.localStorage.setItem(LIST_POSITION_KEY, value); } catch { }
  };
  const listOnTop = !isMobile && listPosition === 'top';
  const appBarHidden = useAppBarHidden();
  const appBarHiddenRef = useRef(appBarHidden);
  useEffect(() => { appBarHiddenRef.current = appBarHidden; }, [appBarHidden]);
  // Barra fixa do show (mobile): guarda a maior altura medida (com os controles abertos)
  // para o espaçador não mudar de tamanho quando os controles recolhem.
  const [barEl, setBarEl] = React.useState<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = React.useState(0);

  useLayoutEffect(() => {
    if (!barEl) return;
    const observer = new ResizeObserver(() => {
      setBarHeight((prev) => Math.max(prev, barEl.offsetHeight));
    });
    observer.observe(barEl);
    return () => observer.disconnect();
  }, [barEl]);
  // Linha da barra fixa (mobile) onde a cifra renderiza os controles de tom/fonte/editar
  const [controlsSlot, setControlsSlot] = React.useState<HTMLDivElement | null>(null);
  const {
    activeStep,
    completed,
    lyricToShow,
    readyToRender,
    sheetMusicToShow,
    handleNext,
    handleBack,
    handleStep,
    downHandler,
    changeOffSet,
    openUpdatedSuccess,
    openUpdatedStarsSuccess,
    updateStars,
    updateOffset,
    startValueInLoading,
    displacementStart,
    updatingStarsLoading,
    offsetsUpdateds,
    offsetIsUpdating,
    handleCloseUpdatedSuccess,
  } = useShowSheetMusic({ sheetMusicId });

  const stepRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);

  useEffect(() => {
    if (sheetMusicToShow && sheetMusicToShow.lyrics) {
      stepRefs.current = sheetMusicToShow.lyrics.map((_, i) => stepRefs.current[i] || createRef());
    }
  }, [sheetMusicToShow?.lyrics]);

  const lyricWrapRef = useRef<HTMLDivElement>(null);
  const getLyricContent = () => lyricWrapRef.current?.querySelector<HTMLElement>('[data-lyric-content]') ?? null;

  // Tela de toque: arrastar para o lado em qualquer lugar da música troca de música.
  // (Os eventos são de toque, então com mouse nada muda.)
  const lyricsCount = sheetMusicToShow?.lyrics.length ?? 0;
  const { takeSwipeDirection } = useSwipeNavigation({
    enabled: readyToRender && !songListOpen,
    getContent: getLyricContent,
    isExcluded: (target) =>
      !!barEl?.contains(target) ||
      !!target.closest('header, nav, [data-song-sidebar], [data-follow-controls], [role="dialog"], .MuiModal-root, .MuiPopper-root, input, textarea, select'),
    canPrev: activeStep > 0,
    canNext: activeStep < lyricsCount - 1,
    onPrev: handleBack,
    onNext: handleNext,
  });

  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const swipeDir = takeSwipeDirection();
    if (swipeDir) {
      // Troca por gesto: a música nova entra pelo lado oposto ao que a anterior saiu.
      // Só o conteúdo da cifra se move (o invólucro tem controles "fixed" dentro).
      const content = getLyricContent();
      if (content) {
        content.style.transition = '';
        content.style.transform = '';
        content.style.opacity = '';
        content.style.willChange = '';
        if (!reduceMotion && typeof content.animate === 'function') {
          const from = Math.round(window.innerWidth * 0.3) * swipeDir;
          content.animate(
            [{ transform: `translate3d(${from}px, 0, 0)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
          );
        }
        return;
      }
    }
    // Transição curta ao trocar de música: só opacidade, para não mexer nos controles "fixed" da cifra.
    const el = lyricWrapRef.current;
    if (!el || typeof el.animate !== 'function' || reduceMotion) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }, [activeStep, takeSwipeDirection]);

  useLayoutEffect(() => {
    // No mobile a cifra rola com a página: ao trocar de música, volta para o topo.
    // As barras do topo ficam como estavam: se estavam escondidas, voltar ao topo não pode fazê-las
    // descer (e subir de novo logo depois com a rolagem automática). O pedido vem depois do scroll,
    // para a referência de "rolou para cima" já ser o topo.
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (appBarHiddenRef.current) requestHideBars();
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (activeStep < stepRefs.current.length && stepRefs.current[activeStep].current) {
      const stepElement = stepRefs.current[activeStep].current;
      stepElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeStep]);

  const RenderStepper = (value: lyricInSheetMusicType, index: number) => {
    const isStepperActive = activeStep === index;
    return (
      <Step key={value.lyricId} completed={completed[index]} ref={stepRefs.current[index]}>
        <StepButton
          onClick={() => { handleStep(index); setSongListOpen(false); }}
          icon={
            <ArtistAvatar
              composerId={value.composerId}
              image={value.composerImage}
              name={value.composerName}
              size={STEP_AVATAR}
              active={isStepperActive}
              dimmed={completed[index] && !isStepperActive}
              badge={completed[index] && !isStepperActive ? <PlayedBadge /> : index + 1}
            />
          }
          sx={(theme) => ({
            fontSize: '2px',
            position: 'relative',
            // cores de estado do StepLabel
            '& .MuiStepLabel-root .Mui-completed': {
              color: theme.palette.primary.light,
            },
            '& .MuiStepLabel-root .Mui-active': {
              color: theme.palette.primary.main,
            },
          })}
        >
          <Typography
            sx={{
              fontWeight: isStepperActive ? 600 : 500,
              fontSize: 13,
              lineHeight: 1.3,
              color: isStepperActive ? 'primary.main' : 'text.primary',
            }}
          >
            {value.lyricName}
          </Typography>

          <Typography sx={[{ fontSize: 11, lineHeight: 1.3 }, (theme) => ({ color: theme.palette.text.secondary })]}>
            {value.composerName}
          </Typography>

          <Box sx={{ position: 'absolute', display: 'flex' }}>
            <Rating
              sx={{ fontSize: 12 }}
              name='size-small'
              size='small'
              value={displacementStart && activeStep === index ? startValueInLoading : value.stars}
              onChange={(_, newValue) => { updateStars(newValue); }}
              readOnly={updatingStarsLoading || displacementStart}
            />
            {updatingStarsLoading && activeStep === index ? (
              <Box sx={{ position: 'relative' }}>
                <CircularProgress
                  size={9}
                  color='primary' // use a prop, não sx.color
                  sx={{ position: 'absolute', left: 5, top: 1.5 }}
                />
              </Box>
            ) : null}
          </Box>
        </StepButton>
      </Step>
    );
  };

  useEffect(() => {
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  });

  const RenderLyric = (columnHeight?: number) => {
    if (!lyricToShow || !sheetMusicToShow) return null;

    return (
      <LyricShowComponent
        changeOffSet={changeOffSet}
        handleNext={handleNext}
        lyricToShow={lyricToShow}
        nextLyricToShow={sheetMusicToShow.lyrics[activeStep + 1]}
        offsetsUpdateds={offsetsUpdateds[activeStep]}
        updateOffset={updateOffset}
        offsetIsUpdating={offsetIsUpdating}
        offsetLyricToShow={lyricToShow.offset!}
        isOneLyric={false}
        mobileControlsContainer={isMobile ? controlsSlot : null}
        columnHeight={columnHeight}
      />
    );
  };

  const heightScreen = typeof window !== 'undefined' ? window.innerHeight - 160 : 600;

  if (!readyToRender) return <SkeletonComponent />;
  if (!lyricToShow || !sheetMusicToShow) return null;

  const total = sheetMusicToShow.lyrics.length;
  const currentLyric = sheetMusicToShow.lyrics[activeStep];

  const snackbars = (
    <>
      <Snackbar open={openUpdatedSuccess} autoHideDuration={6000} onClose={handleCloseUpdatedSuccess}>
        <Alert onClose={handleCloseUpdatedSuccess} severity='success' sx={{ width: '100%' }}>
          Tom atualizado!
        </Alert>
      </Snackbar>

      <Snackbar open={openUpdatedStarsSuccess} autoHideDuration={6000} onClose={handleCloseUpdatedSuccess}>
        <Alert onClose={handleCloseUpdatedSuccess} severity='success' sx={{ width: '100%' }}>
          Nível de tocabilidade atualizado!
        </Alert>
      </Snackbar>
    </>
  );

  /** Alterna onde fica a lista de músicas (só tablet/desktop). */
  const listPositionToggle = (fullWidth: boolean) => (
    <ToggleButtonGroup
      size='small'
      exclusive
      fullWidth={fullWidth}
      value={listPosition}
      onChange={(_, value: ListPosition | null) => { if (value) changeListPosition(value); }}
      aria-label='posição da lista de músicas'
      sx={{
        '& .MuiToggleButton-root': {
          gap: 0.75,
          px: 1.25,
          py: 0.4,
          fontSize: 12,
          lineHeight: 1.5,
          textTransform: 'none',
          whiteSpace: 'nowrap',
        },
      }}
    >
      <ToggleButton value='side' aria-label='lista de músicas ao lado'>
        <VerticalSplitOutlinedIcon sx={{ fontSize: 16 }} />
        Lista ao lado
      </ToggleButton>
      <ToggleButton value='top' aria-label='lista de músicas em cima'>
        <HorizontalSplitOutlinedIcon sx={{ fontSize: 16 }} />
        Lista em cima
      </ToggleButton>
    </ToggleButtonGroup>
  );

  /** Anterior · nome da música (abre a lista) · próxima. */
  const navRow = (trailing?: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton aria-label='música anterior' onClick={() => handleBack()} disabled={activeStep === 0}>
        <NavigateBeforeIcon />
      </IconButton>

      <ButtonBase
        onClick={() => setSongListOpen(true)}
        aria-label='abrir lista de músicas do repertório'
        sx={{ flex: 1, minWidth: 0, flexDirection: 'column', borderRadius: 1, py: 0.5 }}
      >
        <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary', maxWidth: '100%' }}>
          {sheetMusicToShow.sheetMusicName} · Música {activeStep + 1} de {total}
        </Typography>
        <Stack direction='row' sx={{ alignItems: 'center', maxWidth: '100%', gap: 0.75 }}>
          {currentLyric ? (
            <ArtistAvatar
              composerId={currentLyric.composerId}
              image={currentLyric.composerImage}
              name={currentLyric.composerName}
              size={20}
            />
          ) : null}
          <Typography noWrap sx={{ fontFamily: displayFontFamily, fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
            {currentLyric?.lyricName}
          </Typography>
          <ExpandLessIcon fontSize='small' sx={{ color: 'text.secondary' }} />
        </Stack>
      </ButtonBase>

      <IconButton aria-label='próxima música' onClick={() => handleNext()} disabled={activeStep >= total - 1}>
        <NavigateNextIcon />
      </IconButton>

      {trailing}
    </Box>
  );

  /** Lista de músicas do repertório (folha que sobe de baixo), usada com a lista "em cima". */
  const songListSheet = (
    <SwipeableDrawer
      anchor='bottom'
      open={songListOpen}
      onOpen={() => setSongListOpen(true)}
      onClose={() => setSongListOpen(false)}
      disableSwipeToOpen
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            maxHeight: '80dvh',
            // Em telas largas fica centralizada, sem esticar de ponta a ponta.
            width: '100%',
            maxWidth: { md: 560 },
            mx: 'auto',
          },
        },
      }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 'bold' }}>{sheetMusicToShow.sheetMusicName}</Typography>
          {sheetMusicToShow.description && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sheetMusicToShow.description}</Typography>
          )}
        </Box>
        <IconButton
          aria-label='alterar repertório'
          size='small'
          onClick={() => { router.push(`/sheet-music/manage-sheet-music/${sheetMusicId}`); }}
        >
          <OpenInNewIcon fontSize='small' />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ overflowY: 'auto', px: 2, py: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <Stepper nonLinear activeStep={activeStep} orientation='vertical' sx={stepperSx}>
          {sheetMusicToShow.lyrics.map((value: any, index: number) => RenderStepper(value, index))}
        </Stepper>
      </Box>
    </SwipeableDrawer>
  );

  if (isMobile) {
    return (
      <>
        {/* Barra de navegação do show (fixa abaixo do AppBar).
            É "fixed" + espaçador de altura constante: esconder/mostrar partes dela não muda a altura
            da página, senão o navegador corrige o scroll e o esconde/mostra entra em loop. */}
        <Box sx={{ height: barHeight }} />
        <Paper
          ref={setBarEl}
          square
          elevation={0}
          sx={[
            (t) => fixedBelowToolbar(t, appBarHidden),
            (t) => ({
              position: 'fixed',
              left: 0,
              right: 0,
              zIndex: t.zIndex.appBar - 1,
              px: 0.5,
              pt: 0.5,
              // Com os controles recolhidos, o progresso já fecha a barra embaixo: sem linha extra.
              borderBottom: appBarHidden ? 'none' : `1px solid ${t.palette.divider}`,
              '@supports (backdrop-filter: blur(1px))': {
                backgroundColor: alpha(t.palette.background.default, 0.82),
                backdropFilter: 'saturate(160%) blur(14px)',
              },
            }),
          ]}
        >
          {navRow()}

          {/* O progresso é o próprio divisor entre a navegação e os controles (largura total, sem respiro). */}
          <Box sx={{ mx: -0.5, mt: 0.5 }}>
            <SetlistProgress current={activeStep} total={total} height={2} square />
          </Box>

          {/* Tom, salvar tom, fonte e editar (renderizados pela cifra via portal).
              Somem junto com o AppBar ao rolar para baixo e voltam ao rolar para cima. */}
          <Collapse in={!appBarHidden} timeout={{ enter: 225, exit: 195 }}>
            <Box
              ref={setControlsSlot}
              sx={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 40,
                px: 1,
                pt: 1, // espaço para o badge do tom
                pb: 0.5,
              }}
            />
          </Collapse>
        </Paper>

        {/* overflowX "clip": a cifra deslizando para o lado (gesto de troca) não pode alargar a página,
            senão o navegador desloca as barras fixas. Diferente de "hidden", não cria área de rolagem. */}
        <Box ref={lyricWrapRef} sx={{ px: 1.5, pt: 1.5, overflowX: 'clip' }}>
          {RenderLyric()}
        </Box>

        {songListSheet}
        {snackbars}
      </>
    );
  }

  // Tablet/desktop: a cifra fica direto na página (sem card) e quem rola é a própria página.
  // overflowX "clip": a cifra deslizando no gesto de troca não alarga a página.
  const stageSx = { flex: 1, minWidth: 0, pt: 1, overflowX: 'clip' } as const;
  // O AppBar do desktop é "fixed" (64px): o que gruda no topo fica logo abaixo dele.
  const STICKY_TOP = 64 + 8;

  if (listOnTop) {
    // Lista em cima: barra de navegação como no celular (grudada no topo) e a cifra com a largura toda.
    const stageHeight = Math.max(240, heightScreen + 60 - barHeight - 8);
    return (
      <>
        <Box sx={{ mt: 1, mx: 2 }}>
          <Paper
            ref={setBarEl}
            variant='outlined'
            sx={(t) => ({
              position: 'sticky',
              top: STICKY_TOP,
              zIndex: t.zIndex.appBar - 1,
              borderRadius: 2,
              mb: 1,
              px: 0.5,
              pt: 0.5,
              overflow: 'hidden',
              '@supports (backdrop-filter: blur(1px))': {
                backgroundColor: alpha(t.palette.background.default, 0.82),
                backdropFilter: 'saturate(160%) blur(14px)',
              },
            })}
          >
            {navRow(<Box sx={{ pl: 1, pr: 0.5 }}>{listPositionToggle(false)}</Box>)}
            <Box sx={{ mx: -0.5, mt: 0.5 }}>
              <SetlistProgress current={activeStep} total={total} height={2} square />
            </Box>
          </Paper>

          <Box ref={lyricWrapRef} sx={stageSx}>
            {RenderLyric(stageHeight)}
          </Box>
        </Box>

        {songListSheet}
        {snackbars}
      </>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 1, mr: 2 }}>
        {/* A lista fica grudada no topo enquanto a página rola; só a lista de músicas rola por dentro. */}
        <Box
          data-song-sidebar
          sx={{
            position: 'sticky',
            top: STICKY_TOP,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: `calc(100dvh - ${STICKY_TOP + 8}px)`,
            minWidth: 200,
            maxWidth: 250,
            ml: 2,
            mt: 1,
            mr: 3,
            flexShrink: 0,
          }}
        >
          <Box sx={{ mb: 1.5 }}>{listPositionToggle(true)}</Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 17, color: 'text.primary' }}
              variant='h5'
            >
              {sheetMusicToShow.sheetMusicName}
            </Typography>

            <IconButton
              onClick={() => { router.push(`/sheet-music/manage-sheet-music/${sheetMusicId}`); }}
              size='small'
              color='inherit'
            >
              <LightTooltip title='Alterar repertório' placement='top'>
                <OpenInNewIcon sx={{ fontSize: 13 }} />
              </LightTooltip>
            </IconButton>
          </Box>

          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {sheetMusicToShow.description}
          </Typography>

          <Box sx={{ width: '90%', mt: 1.5, mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              Música {activeStep + 1} de {total}
            </Typography>
            <SetlistProgress current={activeStep} total={total} height={4} />
          </Box>

          <Box
            sx={(theme) => ({
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              // Folga para o anel da música atual (4px fora do avatar) não ser cortado pela rolagem;
              // a margem negativa mantém a lista alinhada com o título.
              ml: '-6px',
              pl: '6px',
              mt: '-6px',
              pt: '6px',
              // Scrollbar theme-aware
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-track': {
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.06)
                  : alpha(theme.palette.common.black, 0.06),
              },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.28)
                  : alpha(theme.palette.common.black, 0.28),
                borderRadius: 2,
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.4)
                  : alpha(theme.palette.common.black, 0.4),
              },
            })}
          >
            <Stepper nonLinear activeStep={activeStep} orientation='vertical' sx={stepperSx}>
              {total > 0 &&
                sheetMusicToShow.lyrics.map((value: any, index: number) => RenderStepper(value, index))}
            </Stepper>
          </Box>
        </Box>

        {/* Coluna direita (conteúdo) */}
        <Box ref={lyricWrapRef} sx={stageSx}>
          {RenderLyric(heightScreen + 60)}
        </Box>
      </Box>

      {/* Snackbars usam a paleta do tema automaticamente via severity */}
      {snackbars}
    </>
  );
};
