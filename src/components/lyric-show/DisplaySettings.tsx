import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import FormatSizeRoundedIcon from '@mui/icons-material/FormatSizeRounded';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import { DeviceDisplayPrefs, DISPLAY_LIMITS, DisplayDevice } from '../../utils/lyricDisplayPrefs';
import type { DisplaySaveStatus } from '../../hooks/useLyricDisplayPrefs';

type Props = {
  device: DisplayDevice;
  prefs: DeviceDisplayPrefs;
  onChange: (patch: Partial<DeviceDisplayPrefs>) => void;
  onReset: () => void;
  isDefault: boolean;
  status: DisplaySaveStatus;
  canSyncProfile: boolean;
  size?: 'small' | 'medium';
};

const decimal = (v: number, digits: number) => v.toFixed(digits).replace('.', ',');

/** Botão "Aa" que abre os ajustes de texto da cifra: popover no computador, gaveta de baixo no celular. */
export function DisplaySettingsButton(props: Props) {
  const { device, size = 'medium' } = props;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const open = !!anchor;
  const close = () => setAnchor(null);
  const isMobile = device === 'mobile';

  return (
    <>
      <Tooltip title='Texto e espaçamento'>
        <IconButton
          size={size}
          aria-label='ajustar texto e espaçamento da cifra'
          aria-haspopup='dialog'
          aria-expanded={open}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={open ? { color: 'primary.main' } : undefined}
        >
          <FormatSizeRoundedIcon fontSize={size === 'small' ? 'small' : 'medium'} />
        </IconButton>
      </Tooltip>

      {isMobile ? (
        <Drawer
          anchor='bottom'
          open={open}
          onClose={close}
          // Fundo quase transparente: a cifra atrás muda na hora e precisa ficar visível.
          slotProps={{
            backdrop: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.15)' } },
            paper: {
              sx: (t) => ({
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: '70vh',
                pb: 'env(safe-area-inset-bottom)',
                borderTop: `1px solid ${t.palette.divider}`,
              }),
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <Box sx={(t) => ({ width: 36, height: 4, borderRadius: 2, backgroundColor: alpha(t.palette.text.primary, 0.2) })} />
          </Box>
          <SettingsPanel {...props} onDone={close} />
        </Drawer>
      ) : (
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: (t) => ({
                mt: 1,
                width: 340,
                borderRadius: 4,
                border: `1px solid ${t.palette.divider}`,
                boxShadow: t.shadows[8],
              }),
            },
          }}
        >
          <SettingsPanel {...props} />
        </Popover>
      )}
    </>
  );
}

function SettingsPanel({ device, prefs, onChange, onReset, isDefault, status, canSyncProfile, onDone }: Props & { onDone?: () => void }) {
  const limits = DISPLAY_LIMITS[device];
  const isMobile = device === 'mobile';

  return (
    <Box sx={{ px: 2.5, pt: isMobile ? 1.5 : 2, pb: 2 }} role='dialog' aria-label='Texto e espaçamento da cifra'>
      <Stack direction='row' sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Texto da cifra</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {isMobile ? 'No celular' : 'No computador'}
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        <SettingRow
          label='Tamanho da fonte'
          value={prefs.fontSize}
          valueLabel={`${prefs.fontSize} px`}
          range={limits.fontSize}
          onChange={(fontSize) => onChange({ fontSize })}
          less='diminuir fonte'
          more='aumentar fonte'
        />
        <SettingRow
          label='Espaço entre linhas'
          value={prefs.lineHeight}
          valueLabel={`${decimal(prefs.lineHeight, 2)}×`}
          range={limits.lineHeight}
          onChange={(lineHeight) => onChange({ lineHeight })}
          less='diminuir espaço entre linhas'
          more='aumentar espaço entre linhas'
        />
        <SettingRow
          label='Espaço entre letras'
          value={prefs.letterSpacing}
          valueLabel={prefs.letterSpacing === 0 ? 'Normal' : `+${Math.round(prefs.letterSpacing * 100)}%`}
          range={limits.letterSpacing}
          onChange={(letterSpacing) => onChange({ letterSpacing })}
          less='diminuir espaço entre letras'
          more='aumentar espaço entre letras'
        />
        {!isMobile && (
          <SettingRow
            label='Espaço entre colunas'
            value={prefs.columnGap}
            valueLabel={`${prefs.columnGap} px`}
            range={limits.columnGap}
            onChange={(columnGap) => onChange({ columnGap })}
            less='diminuir espaço entre colunas'
            more='aumentar espaço entre colunas'
          />
        )}
      </Stack>

      <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2, gap: 1 }}>
        <SaveStatus status={status} canSyncProfile={canSyncProfile} />
        <Stack direction='row' spacing={1} sx={{ flexShrink: 0 }}>
          <Button size='small' color='inherit' onClick={onReset} disabled={isDefault}>
            Restaurar
          </Button>
          {onDone && (
            <Button size='small' variant='contained' onClick={onDone}>
              Pronto
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function SettingRow({
  label, value, valueLabel, range, onChange, less, more,
}: {
  label: string;
  value: number;
  valueLabel: string;
  range: { min: number; max: number; step: number };
  onChange: (v: number) => void;
  less: string;
  more: string;
}) {
  return (
    <Box>
      <Stack direction='row' sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{valueLabel}</Typography>
      </Stack>
      <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
        <IconButton size='small' aria-label={less} disabled={value <= range.min} onClick={() => onChange(value - range.step)}>
          <RemoveRoundedIcon fontSize='small' />
        </IconButton>
        <Slider
          size='small'
          value={value}
          min={range.min}
          max={range.max}
          step={range.step}
          onChange={(_, v) => onChange(v as number)}
          aria-label={label}
          getAriaValueText={() => valueLabel}
          sx={{ flex: 1 }}
        />
        <IconButton size='small' aria-label={more} disabled={value >= range.max} onClick={() => onChange(value + range.step)}>
          <AddRoundedIcon fontSize='small' />
        </IconButton>
      </Stack>
    </Box>
  );
}

function SaveStatus({ status, canSyncProfile }: { status: DisplaySaveStatus; canSyncProfile: boolean }) {
  const sx = { fontSize: 11.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 } as const;

  if (!canSyncProfile) return <Typography sx={sx}>Salvo neste aparelho</Typography>;
  if (status === 'error') {
    return (
      <Typography sx={{ ...sx, color: 'error.main' }}>
        <CloudOffOutlinedIcon sx={{ fontSize: 15 }} /> Não salvou no perfil
      </Typography>
    );
  }
  return (
    <Typography sx={sx}>
      <CloudDoneOutlinedIcon sx={{ fontSize: 15 }} /> {status === 'saving' ? 'Salvando…' : 'Salvo no seu perfil'}
    </Typography>
  );
}
