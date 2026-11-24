import React from 'react';
import Portal from '@mui/material/Portal';
import { keyframes } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { ChordDiagram } from './ChordDiagram';
import { KeyboardDiagram, noteName } from './KeyboardDiagram';
import { InstrumentIcon } from './InstrumentIcon';
import { DEFAULT_INSTRUMENT_ID, getInstrument, INSTRUMENTS } from '../../utils/chords/instruments';
import { parseChord } from '../../utils/chords/parseChord';
import { generateVoicings } from '../../utils/chords/voicings';
import { generateKeyboardVoicings, inversionLabel, KeyboardVoicing } from '../../utils/chords/keyboardVoicings';
import { playFretted, playKeyboard } from '../../utils/chords/chordAudio';
import { monoFont } from '../../theme/createAppTheme';

const MAX_VARIATIONS = 8;
const CARD_WIDTH = 236;
const CARD_HEIGHT_GUESS = 330;
const EDGE = 8;
// Acima da barra do app, abaixo de menus/diálogos (1300) e snackbars (1400) do MUI.
const BASE_Z = 1250;
const Z_SPAN = 40;
/** Tamanho do card: 70% a 200%. O último tamanho usado vale para os próximos cards. */
const SCALE_MIN = 0.7;
const SCALE_MAX = 2;
const SCALE_STORAGE_KEY = 'chord-card-scale';

/**
 * Cantos de redimensionar (áreas invisíveis; só o cursor do mouse muda).
 * sx/sy = para que lado o canto cresce (-1 esquerda/cima, 1 direita/baixo).
 */
type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: Record<Corner, { sx: number; sy: number }> = {
  tl: { sx: -1, sy: -1 },
  tr: { sx: 1, sy: -1 },
  bl: { sx: -1, sy: 1 },
  br: { sx: 1, sy: 1 },
};

function readStoredScale(): number {
  try {
    const v = Number(window.localStorage.getItem(SCALE_STORAGE_KEY));
    if (v >= SCALE_MIN && v <= SCALE_MAX) return v;
  } catch { }
  return 1;
}

function storeScale(v: number) {
  try { window.localStorage.setItem(SCALE_STORAGE_KEY, String(v)); } catch { }
}

/** Tempo com o mouse parado em cima do acorde até abrir a prévia. */
const HOVER_OPEN_MS = 400;
/** Folga para o mouse sair do acorde e chegar no card sem ele sumir. */
const HOVER_CLOSE_MS = 200;

export type ChordDiagramCardsHandle = {
  /** Clique no acorde: abre um card fixo (ou fixa a prévia que já está aberta). */
  open: (chordName: string, rect: DOMRect) => void;
  /** Mouse em cima de um acorde: abre uma prévia depois de um tempo parado. */
  hoverChord: (chordName: string, rect: DOMRect) => void;
  /** Mouse saiu do acorde: a prévia some (se o mouse não for para ela). */
  leaveChord: () => void;
};

/** Duração das animações de abrir e fechar o card. */
const ENTER_MS = 240;
const EXIT_MS = 160;

// O card "nasce" do acorde (transform-origin no acorde) e volta para ele ao sumir.
const cardEnter = keyframes`
  0% { opacity: 0; transform: scale(0.55); filter: blur(3px); }
  60% { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: scale(1); filter: blur(0); }
`;
const cardExit = keyframes`
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.8); }
`;
const cardFade = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

/**
 * pinned = false é a prévia do hover (só existe uma por vez).
 * ax/ay = centro do acorde que abriu o card (de onde a animação sai).
 * closing = está tocando a animação de saída; some de vez quando ela termina.
 */
type Card = {
  id: number; name: string; x: number; y: number; z: number; pinned: boolean; anchor: string;
  ax: number; ay: number; closing?: boolean;
};

const isLive = (c: Card) => !c.closing;
const isLivePreview = (c: Card) => !c.pinned && !c.closing;
const livePinned = (cards: Card[]) => cards.filter((c) => c.pinned && !c.closing);

/** Começa a animação de saída da prévia (se houver uma aberta). */
function dismissPreview(cards: Card[]): Card[] {
  return cards.some(isLivePreview) ? cards.map((c) => (isLivePreview(c) ? { ...c, closing: true } : c)) : cards;
}

const anchorKey = (name: string, rect: DOMRect) => `${name}@${Math.round(rect.left)},${Math.round(rect.top)}`;

function newCard(id: number, name: string, rect: DOMRect, others: Card[], z: number, pinned: boolean): Card {
  return {
    id, name, ...placeNear(rect, others), z, pinned, anchor: anchorKey(name, rect),
    ax: rect.left + rect.width / 2, ay: rect.top + rect.height / 2,
  };
}

function placeNear(rect: DOMRect, others: Card[]) {
  let x = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  let y = rect.bottom + 4;
  if (y + CARD_HEIGHT_GUESS > window.innerHeight - EDGE) y = rect.top - CARD_HEIGHT_GUESS - 4;
  // Não esconde exatamente atrás de outro card.
  while (others.some((c) => Math.abs(c.x - x) < 12 && Math.abs(c.y - y) < 12)) { x += 24; y += 24; }
  return clamp(x, y, CARD_WIDTH, CARD_HEIGHT_GUESS);
}

/** Mantém os z-index numa faixa curta (senão, de tanto trazer para frente, passariam dos menus). */
function normalizeZ(cards: Card[], topZ: { current: number }): Card[] {
  if (topZ.current <= BASE_Z + Z_SPAN) return cards;
  const order = [...cards].sort((a, b) => a.z - b.z).map((c) => c.id);
  topZ.current = BASE_Z + cards.length;
  return cards.map((c) => ({ ...c, z: BASE_Z + 1 + order.indexOf(c.id) }));
}

function clamp(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(EDGE, window.innerWidth - w - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - h - EDGE);
  return { x: Math.min(Math.max(EDGE, x), maxX), y: Math.min(Math.max(EDGE, y), maxY) };
}

/**
 * Cards flutuantes com o desenho dos acordes.
 * Não bloqueiam a página (dá para rolar e clicar em tudo), podem ser arrastados
 * e vários podem ficar abertos ao mesmo tempo. Ficam fixos na tela durante a rolagem.
 */
export const ChordDiagramCards = React.forwardRef<ChordDiagramCardsHandle>(function ChordDiagramCards(_, ref) {
  const [cards, setCards] = React.useState<Card[]>([]);
  const nextId = React.useRef(1);
  const topZ = React.useRef(BASE_Z);

  // Controle do hover (fora do estado para não renderizar a cada movimento do mouse)
  const hoverKey = React.useRef<string | null>(null);
  const previewKey = React.useRef<string | null>(null);
  const openTimer = React.useRef<number | undefined>(undefined);
  const closeTimer = React.useRef<number | undefined>(undefined);

  const cancelPreviewClose = React.useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);
  const schedulePreviewClose = React.useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      previewKey.current = null;
      setCards(dismissPreview);
    }, HOVER_CLOSE_MS);
  }, []);

  React.useEffect(() => () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  React.useImperativeHandle(ref, () => ({
    open: (name, rect) => {
      window.clearTimeout(openTimer.current);
      cancelPreviewClose();
      previewKey.current = null;
      setCards((prev) => {
        const z = ++topZ.current;
        const preview = prev.find(isLivePreview);
        // Clique no acorde da prévia: ela vira card fixo.
        if (preview && preview.name === name) {
          return normalizeZ(prev.map((c) => (c.id === preview.id ? { ...c, pinned: true, z } : c)), topZ);
        }
        const kept = dismissPreview(prev);
        const pinned = livePinned(kept);
        // Acorde já aberto: só traz para frente.
        const existing = pinned.find((c) => c.name === name);
        if (existing) return normalizeZ(kept.map((c) => (c.id === existing.id ? { ...c, z } : c)), topZ);
        return normalizeZ([...kept, newCard(nextId.current++, name, rect, pinned, z, true)], topZ);
      });
    },

    hoverChord: (name, rect) => {
      const key = anchorKey(name, rect);
      if (key === hoverKey.current) return;
      hoverKey.current = key;
      window.clearTimeout(openTimer.current);
      // Voltou para o acorde da prévia aberta: mantém.
      if (key === previewKey.current) { cancelPreviewClose(); return; }
      schedulePreviewClose();
      openTimer.current = window.setTimeout(() => {
        cancelPreviewClose();
        previewKey.current = key;
        setCards((prev) => {
          const kept = dismissPreview(prev);
          const pinned = livePinned(kept);
          // Já está aberto fixo: não precisa de prévia.
          if (pinned.some((c) => c.name === name)) { previewKey.current = null; return kept; }
          const z = ++topZ.current;
          return normalizeZ([...kept, newCard(nextId.current++, name, rect, pinned, z, false)], topZ);
        });
      }, HOVER_OPEN_MS);
    },

    leaveChord: () => {
      if (hoverKey.current === null) return;
      hoverKey.current = null;
      window.clearTimeout(openTimer.current);
      schedulePreviewClose();
    },
  }), [cancelPreviewClose, schedulePreviewClose]);

  /** Fechar começa a animação de saída; remove() tira o card quando ela termina. */
  const close = React.useCallback((id: number) => {
    setCards((prev) => prev.map((c) => (c.id === id && !c.closing ? { ...c, closing: true } : c)));
  }, []);
  const remove = React.useCallback((id: number) => setCards((prev) => prev.filter((c) => c.id !== id)), []);
  /** Tocar/arrastar o card traz para frente e, se for a prévia, fixa ela. */
  const focus = React.useCallback((id: number) => {
    setCards((prev) => {
      const card = prev.find((c) => c.id === id);
      if (!card || !isLive(card)) return prev;
      if (!card.pinned) {
        cancelPreviewClose();
        previewKey.current = null;
      } else if (card.z === topZ.current) return prev;
      const z = ++topZ.current;
      return normalizeZ(prev.map((c) => (c.id === id ? { ...c, z, pinned: true } : c)), topZ);
    });
  }, [cancelPreviewClose]);
  /** Mouse entrando/saindo da prévia: enquanto estiver em cima, ela fica. */
  const hoverCard = React.useCallback((pinned: boolean, inside: boolean) => {
    if (pinned) return;
    if (inside) {
      // Em cima do card o mouse não está mais em nenhum acorde.
      hoverKey.current = null;
      window.clearTimeout(openTimer.current);
      cancelPreviewClose();
    } else if (hoverKey.current === null) schedulePreviewClose();
  }, [cancelPreviewClose, schedulePreviewClose]);
  const move = React.useCallback((id: number, x: number, y: number) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
  }, []);

  // Se a janela diminuir (ou o celular girar), traz os cards de volta para a tela.
  React.useEffect(() => {
    if (!cards.length) return;
    const onResize = () => setCards((prev) => prev.map((c) => ({ ...c, ...clamp(c.x, c.y, CARD_WIDTH, 120) })));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [cards.length]);

  if (!cards.length) return null;

  return (
    <Portal>
      {cards.map((card) => (
        <ChordCard key={card.id} card={card} onClose={close} onRemove={remove} onFocus={focus} onMove={move} onHover={hoverCard} />
      ))}
    </Portal>
  );
});

type CardProps = {
  card: Card;
  onClose: (id: number) => void;
  onRemove: (id: number) => void;
  onFocus: (id: number) => void;
  onMove: (id: number, x: number, y: number) => void;
  onHover: (pinned: boolean, inside: boolean) => void;
};

const ChordCard = React.memo(function ChordCard({ card, onClose, onRemove, onFocus, onMove, onHover }: CardProps) {
  // Todo card abre no violão.
  const [instrumentId, setInstrumentId] = React.useState<string>(DEFAULT_INSTRUMENT_ID);
  const [index, setIndex] = React.useState(0);
  const paperRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [scale, setScale] = React.useState<number>(readStoredScale);
  const resize = React.useRef<{
    pointerId: number; corner: Corner; px: number; py: number;
    start: number; x: number; y: number; w: number; h: number;
  } | null>(null);

  /** Mantém o card inteiro na tela (ao abrir e depois de mudar o tamanho). */
  const keepInside = React.useCallback(() => {
    const el = paperRef.current;
    if (!el) return;
    const pos = clamp(card.x, card.y, el.offsetWidth, el.offsetHeight);
    if (pos.x !== card.x || pos.y !== card.y) onMove(card.id, pos.x, pos.y);
  }, [card.id, card.x, card.y, onMove]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => { keepInside(); }, []);

  const instrument = getInstrument(instrumentId);
  const parsed = React.useMemo(() => parseChord(card.name), [card.name]);
  const variations = React.useMemo(() => {
    if (!parsed) return null;
    return instrument.kind === 'keyboard'
      ? { kind: 'keyboard' as const, list: generateKeyboardVoicings(parsed) }
      : { kind: 'fretted' as const, instrument, list: generateVoicings(parsed, instrument, MAX_VARIATIONS) };
  }, [parsed, instrument]);
  const count = variations?.list.length ?? 0;

  const changeInstrument = (e: SelectChangeEvent<string>) => {
    setInstrumentId(e.target.value);
    setIndex(0);
  };

  const current = Math.min(index, count - 1);
  const step = (d: number) => setIndex((i) => (i + d + count) % count);
  const variationWord = instrument.kind === 'keyboard' ? 'inversão' : 'digitação';

  const play = () => {
    if (!variations || count === 0) return;
    if (variations.kind === 'fretted') playFretted(variations.instrument, variations.list[current].frets);
    else playKeyboard(variations.list[current].notes, variations.list[current].bass);
  };

  // Arrastar: o card inteiro serve de alça, menos os botões.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Eventos do menu do select (que fica num portal) também chegam aqui pela árvore do React.
    if (!e.currentTarget.contains(e.target as Node)) return;
    onFocus(card.id);
    if (e.button !== 0 || (e.target as Element).closest('button, [role="button"], [role="combobox"], input')) return;
    drag.current = { pointerId: e.pointerId, dx: e.clientX - card.x, dy: e.clientY - card.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = paperRef.current;
    const pos = clamp(e.clientX - d.dx, e.clientY - d.dy, el?.offsetWidth ?? CARD_WIDTH, el?.offsetHeight ?? CARD_HEIGHT_GUESS);
    onMove(card.id, pos.x, pos.y);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  // Redimensionar por qualquer canto: puxar para fora aumenta, para dentro diminui.
  // O canto oposto fica parado (puxando o de cima à esquerda, o card cresce para cima e para a esquerda).
  const onResizeDown = (corner: Corner) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onFocus(card.id);
    const el = paperRef.current;
    resize.current = {
      pointerId: e.pointerId, corner, px: e.clientX, py: e.clientY,
      start: scale, x: card.x, y: card.y, w: el?.offsetWidth ?? CARD_WIDTH, h: el?.offsetHeight ?? CARD_HEIGHT_GUESS,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resize.current;
    if (!r || r.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const { sx, sy } = CORNERS[r.corner];
    const growth = ((sx * (e.clientX - r.px)) / r.w + (sy * (e.clientY - r.py)) / r.h) / 2;
    const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(r.start * (1 + growth) * 100) / 100));
    setScale(next);
    const ratio = next / r.start;
    const x = sx < 0 ? r.x + r.w * (1 - ratio) : r.x;
    const y = sy < 0 ? r.y + r.h * (1 - ratio) : r.y;
    if (x !== card.x || y !== card.y) onMove(card.id, x, y);
  };
  const onResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resize.current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    resize.current = null;
    storeScale(scale);
    keepInside();
  };
  // A animação sai do acorde. Card fixo que foi arrastado para longe some no próprio lugar.
  const nearAnchor = Math.abs(card.ax - card.x - CARD_WIDTH / 2) < CARD_WIDTH * 1.5
    && Math.abs(card.ay - card.y) < CARD_HEIGHT_GUESS * 1.5;
  const origin = card.closing && !nearAnchor ? 'center' : `${card.ax - card.x}px ${card.ay - card.y}px`;

  // Garantia: se a animação não rodar (aba em segundo plano etc.), remove do mesmo jeito.
  React.useEffect(() => {
    if (!card.closing) return;
    const t = window.setTimeout(() => onRemove(card.id), EXIT_MS + 150);
    return () => window.clearTimeout(t);
  }, [card.closing, card.id, onRemove]);

  const resetSize = () => {
    setScale(1);
    storeScale(1);
    window.requestAnimationFrame(keepInside);
  };

  return (
    <Paper
      ref={paperRef}
      role='dialog'
      aria-label={`Acorde ${card.name}`}
      elevation={8}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={() => onHover(card.pinned, true)}
      onMouseLeave={() => onHover(card.pinned, false)}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(card.id); }}
      onAnimationEnd={(e) => {
        // animationend dos filhos (bolinhas do diagrama) também sobe até aqui.
        if (e.target === e.currentTarget && card.closing) onRemove(card.id);
      }}
      sx={{
        position: 'fixed',
        left: card.x,
        top: card.y,
        zIndex: card.z,
        borderRadius: 2 * scale,
        border: 1,
        borderColor: 'divider',
        // Sem isso o toque no celular rola a página em vez de arrastar o card.
        touchAction: 'none',
        userSelect: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        transformOrigin: origin,
        animation: card.closing
          ? `${cardExit} ${EXIT_MS}ms cubic-bezier(.4, 0, 1, 1) forwards`
          : `${cardEnter} ${ENTER_MS}ms cubic-bezier(.2, .9, .3, 1.15) backwards`,
        pointerEvents: card.closing ? 'none' : undefined,
        '@media (prefers-reduced-motion: reduce)': {
          animation: card.closing
            ? `${cardFade} 120ms linear reverse forwards`
            : `${cardFade} 120ms linear backwards`,
        },
      }}
    >
      {/* zoom escala tudo junto (texto, botões e desenho, que é vetorial e continua nítido) */}
      <Stack sx={{ alignItems: 'center', width: CARD_WIDTH, p: 1.25, pt: 0.75, zoom: scale }} spacing={0.75}>
        <Stack direction='row' sx={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <Typography
            component='h2'
            sx={{ flex: 1, ...monoFont, fontWeight: 700, fontSize: 19, color: 'chord.main' }}
          >
            {card.name}
          </Typography>
          <IconButton size='small' aria-label={`fechar ${card.name}`} onClick={() => onClose(card.id)} edge='end'>
            <CloseIcon fontSize='small' />
          </IconButton>
        </Stack>

        <Select
          value={instrument.id}
          onChange={changeInstrument}
          size='small'
          fullWidth
          inputProps={{ 'aria-label': 'instrumento' }}
          MenuProps={{ disableScrollLock: true }}
          renderValue={(id) => (
            <Stack direction='row' sx={{ alignItems: 'center' }} spacing={1}>
              <InstrumentIcon id={id} size={20} />
              <span>{getInstrument(id).name}</span>
            </Stack>
          )}
          sx={{ fontSize: 14, '& .MuiSelect-select': { py: 0.75 } }}
        >
          {INSTRUMENTS.map((inst) => (
            <MenuItem key={inst.id} value={inst.id} dense>
              <ListItemIcon sx={{ color: inst.id === instrument.id ? 'primary.main' : 'text.secondary' }}>
                <InstrumentIcon id={inst.id} size={22} />
              </ListItemIcon>
              <ListItemText primary={inst.name} />
            </MenuItem>
          ))}
        </Select>

        {variations && count > 0 ? (
          <>
            {variations.kind === 'fretted' ? (
              <ChordDiagram voicing={variations.list[current]} instrument={variations.instrument} />
            ) : (
              <KeyboardPanel voicing={variations.list[current]} chordName={card.name} />
            )}
            <Stack direction='row' sx={{ alignItems: 'center' }} spacing={1}>
              <IconButton size='small' aria-label={`${variationWord} anterior`} onClick={() => step(-1)} disabled={count < 2}>
                <ChevronLeftIcon fontSize='small' />
              </IconButton>
              <Typography variant='caption' sx={{ color: 'text.secondary', minWidth: 40, textAlign: 'center' }}>
                {current + 1} / {count}
              </Typography>
              <IconButton size='small' aria-label={`próxima ${variationWord}`} onClick={() => step(1)} disabled={count < 2}>
                <ChevronRightIcon fontSize='small' />
              </IconButton>
              <Button
                size='small'
                variant='outlined'
                startIcon={<PlayArrowRoundedIcon />}
                onClick={play}
                aria-label={`ouvir ${card.name}`}
                sx={{ ml: 0.5, py: 0.25, borderRadius: 4 }}
              >
                Ouvir
              </Button>
            </Stack>
          </>
        ) : (
          <Box sx={{ py: 4, px: 1, textAlign: 'center' }}>
            <Typography variant='body2' sx={{ color: 'text.secondary' }}>
              Não encontrei uma digitação para este acorde no {instrument.name.toLowerCase()}.
            </Typography>
          </Box>
        )}
      </Stack>

      {(Object.keys(CORNERS) as Corner[]).map((corner) => {
        const c = CORNERS[corner];
        return (
          <Box
            key={corner}
            role='separator'
            aria-label='redimensionar (duplo clique volta ao normal)'
            title='Arraste para aumentar ou diminuir · duplo clique volta ao normal'
            onPointerDown={onResizeDown(corner)}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
            onDoubleClick={resetSize}
            sx={{
              position: 'absolute',
              // em cima da borda, para não cobrir o X nem a alça de arrastar
              [c.sy < 0 ? 'top' : 'bottom']: -4,
              [c.sx < 0 ? 'left' : 'right']: -4,
              width: 16,
              height: 16,
              cursor: c.sx === c.sy ? 'nwse-resize' : 'nesw-resize',
              touchAction: 'none',
            }}
          />
        );
      })}
    </Paper>
  );
});

/** Bemóis em tons que costumam ser escritos assim (Bb, Eb, F, Dm, Gm, Cm...). */
function prefersFlats(chordName: string) {
  return /^[A-G]b/.test(chordName) || /^F(?!#)/.test(chordName) || /^[DGC]m(?!aj)/.test(chordName);
}

function KeyboardPanel({ voicing, chordName }: { voicing: KeyboardVoicing; chordName: string }) {
  const flats = prefersFlats(chordName);
  const names = (notes: number[]) => notes.map((m) => noteName(m, flats)).join(' · ');
  return (
    <Stack sx={{ alignItems: 'center', alignSelf: 'stretch' }} spacing={0.5}>
      <Typography variant='caption' sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {inversionLabel(voicing.inversion)}
      </Typography>
      <KeyboardDiagram voicing={voicing} preferFlats={flats} maxWidth={CARD_WIDTH - 24} />
      <Box sx={{ fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
        {voicing.bass != null && (
          <Box>
            <Box component='span' sx={{ color: 'info.main', fontWeight: 700 }}>Mão esquerda: </Box>
            {names([voicing.bass])}
          </Box>
        )}
        <Box>
          <Box component='span' sx={{ color: 'chord.main', fontWeight: 700 }}>
            {voicing.bass != null ? 'Mão direita: ' : 'Notas: '}
          </Box>
          {names(voicing.notes)}
        </Box>
      </Box>
    </Stack>
  );
}
