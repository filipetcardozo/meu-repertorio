import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, keyframes } from '@mui/material/styles';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { displayFontFamily, monoFontFamily } from '../../theme/createAppTheme';
import { transposeKey } from '../../utils/chords/transpose';

const slideUp = keyframes`
  from { transform: translateY(55%); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
`;
const slideDown = keyframes`
  from { transform: translateY(-55%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
`;
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 var(--pulse); }
  70%  { box-shadow: 0 0 0 5px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

type Props = {
  /** Tom cadastrado (sem o offset). */
  originalTone?: string | null;
  /** Tom atual (cadastrado + offset). */
  currentKey: string | null;
  /** Deslocamento em semitons (-5..+6). */
  offset: number;
  onShift: (semitones: number) => void;
  /** Há um tom novo ainda não salvo. */
  pendingSave?: boolean;
  saving?: boolean;
  onSave?: () => void;
};

const fmtOffset = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '');

// Tamanhos fixos: o controle não muda de largura nem de altura (trocar G -> G#m, aparecer o salvar).
const H = 30;
const STEP = 24;
const SAVE = 20;
// Cabe o tom mais largo ("G#m" ~36px em Sora 14) + a etiqueta do deslocamento ("+6" ~18px).
const CENTER_W = 62;

/**
 * Controle de tom compacto: −/+ meio tom e o tom atual com o deslocamento.
 * O botão de salvar surge por cima da borda direita (posição absoluta), sem ocupar espaço.
 */
export function KeyControl({ originalTone, currentKey, offset, onShift, pendingSave, saving, onSave }: Props) {
  const original = transposeKey(originalTone, 0) ?? originalTone ?? null;
  const shifted = offset !== 0;
  const showSave = !!onSave && (!!pendingSave || !!saving);

  // Direção da última troca, para animar o tom subindo/descendo.
  const [anim, setAnim] = React.useState<{ offset: number; dir: 'up' | 'down' }>({ offset, dir: 'up' });
  if (anim.offset !== offset) {
    const delta = ((((offset - anim.offset) % 12) + 18) % 12) - 6; // passa pela volta (+6 -> -5)
    setAnim({ offset, dir: delta >= 0 ? 'up' : 'down' });
  }

  const stepBtn = (delta: 1 | -1) => (
    <ButtonBase
      aria-label={delta > 0 ? 'subir meio tom' : 'descer meio tom'}
      onClick={() => onShift(delta)}
      sx={(t) => ({
        width: STEP,
        height: STEP,
        flexShrink: 0,
        borderRadius: 999,
        color: alpha(t.palette.text.primary, 0.7),
        transition: 'background-color .15s, color .15s, transform .1s',
        '&:hover': { color: t.palette.primary.main, backgroundColor: alpha(t.palette.primary.main, 0.12) },
        '&:active': { transform: 'scale(0.88)' },
        '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
      })}
    >
      {delta > 0 ? <AddRoundedIcon sx={{ fontSize: 16 }} /> : <RemoveRoundedIcon sx={{ fontSize: 16 }} />}
    </ButtonBase>
  );

  const resetTitle = shifted && original ? `Tom original: ${original} · toque para voltar` : 'Tom da música';

  return (
    <Box
      role='group'
      aria-label='tom da música'
      sx={(t) => ({
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        height: H,
        px: '2px',
        borderRadius: 999,
        flexShrink: 0,
        boxSizing: 'border-box',
        // Borda em gradiente (marca) quando transposto; fundo "vidro" por dentro.
        border: '1px solid transparent',
        background: [
          `linear-gradient(${alpha(t.palette.background.paper, 0.9)}, ${alpha(t.palette.background.paper, 0.9)}) padding-box`,
          `${shifted ? t.brand.gradient : `linear-gradient(${alpha(t.palette.text.primary, 0.14)}, ${alpha(t.palette.text.primary, 0.14)})`} border-box`,
        ].join(', '),
        boxShadow: shifted ? `0 0 0 3px ${alpha(t.palette.primary.main, 0.07)}, 0 3px 12px ${alpha(t.palette.primary.main, 0.16)}` : 'none',
        transition: 'box-shadow .25s',
      })}
    >
      {stepBtn(-1)}

      <Tooltip title={resetTitle}>
        <ButtonBase
          aria-label={shifted ? `tom ${currentKey ?? ''}, voltar ao tom original ${original ?? ''}` : `tom ${currentKey ?? ''}`}
          onClick={() => shifted && onShift(-offset)}
          disableRipple={!shifted}
          sx={(t) => ({
            height: STEP,
            width: CENTER_W,
            flexShrink: 0,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            cursor: shifted ? 'pointer' : 'default',
            '&:hover': shifted ? { backgroundColor: alpha(t.palette.primary.main, 0.12) } : undefined,
          })}
        >
          <Box sx={{ overflow: 'hidden', height: 17 }}>
            <Box
              key={currentKey ?? '-'}
              component='span'
              sx={(t) => ({
                display: 'block',
                fontFamily: displayFontFamily,
                fontWeight: 700,
                fontSize: 14,
                lineHeight: '17px',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                color: t.palette.text.primary,
                animation: `${anim.dir === 'up' ? slideUp : slideDown} .22s cubic-bezier(.2,.8,.2,1)`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              })}
            >
              {currentKey ?? '–'}
            </Box>
          </Box>

          {shifted && (
            <Box
              component='span'
              sx={(t) => ({
                fontFamily: monoFontFamily,
                fontSize: 9.5,
                fontWeight: 600,
                lineHeight: 1,
                px: '3px',
                py: '2px',
                borderRadius: 0.75,
                color: t.palette.primary.main,
                backgroundColor: alpha(t.palette.primary.main, 0.16),
              })}
            >
              {fmtOffset(offset)}
            </Box>
          )}
        </ButtonBase>
      </Tooltip>

      {stepBtn(1)}

      {/* Salvar: surge sobre a borda direita, fora do fluxo (não mexe na largura nem na altura). */}
      {onSave && (
        <Tooltip title={saving ? 'Salvando…' : 'Salvar este tom'}>
          <ButtonBase
            aria-label='salvar novo tom'
            aria-hidden={!showSave}
            tabIndex={showSave ? 0 : -1}
            onClick={() => { if (showSave && !saving) onSave(); }}
            sx={(t) => ({
              position: 'absolute',
              top: '50%',
              // Logo à direita da pílula, sem cobrir o + (fora do fluxo, não ocupa espaço).
              right: -(SAVE + 4 + 6),
              width: SAVE,
              height: SAVE,
              borderRadius: 999,
              color: t.palette.primary.contrastText,
              backgroundImage: t.brand.gradient,
              border: `2px solid ${t.palette.background.default}`,
              boxSizing: 'content-box',
              transform: `translateY(-50%) scale(${showSave ? 1 : 0.3})`,
              opacity: showSave ? 1 : 0,
              pointerEvents: showSave ? 'auto' : 'none',
              transition: 'transform .22s cubic-bezier(.3,1.6,.5,1), opacity .15s',
              '--pulse': alpha(t.palette.primary.main, 0.55),
              animation: showSave && !saving ? `${pulse} 1.8s ease-out .3s infinite` : 'none',
              '&:active': { transform: 'translateY(-50%) scale(0.88)' },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'opacity .15s' },
            })}
          >
            {saving ? <CircularProgress size={11} sx={{ color: 'inherit' }} /> : <CheckRoundedIcon sx={{ fontSize: 14 }} />}
          </ButtonBase>
        </Tooltip>
      )}
    </Box>
  );
}
