import { useEffect, useState } from 'react';
import { useShowTimer } from '../../hooks/useShowTimer';
import { Box, Button, IconButton, Snackbar } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrowOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import moment from 'moment'
import { keyframes } from '@mui/system';
import { displayFontFamily } from '../../theme/createAppTheme';

export const ShowTimer = ({ compact = false }: { compact?: boolean }) => {
  const { timer, start, pause, stop, isActive } = useShowTimer();
  const [showAlert, setShowAlert] = useState(false);
  const [alertSet, setAlertSet] = useState(false);

  useEffect(() => {
    if (timer % 900 === 0 && timer !== 0 && !alertSet) {
      setShowAlert(true);
      setAlertSet(true);

      setTimeout(() => {
        setShowAlert(false);
        setAlertSet(false);
      }, 30000);
    } else if (timer % 10 !== 0 && alertSet) {
      setAlertSet(false);
    }
  }, [timer, alertSet]);


  const formatTime = (seconds: number) => {
    if (seconds >= 3600) {
      return seconds >= 60 ? moment.utc(seconds * 1000).format('HH:mm:ss') : `${seconds} segundos`;
    } else {
      return seconds >= 60 ? moment.utc(seconds * 1000).format('mm:ss') : `${seconds} segundos`;
    }
  };

  const running = timer > 0 || isActive;
  const hydrationAlert = (
    <Snackbar
      open={showAlert}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message='🌊 Onda de Hidratação! Dê um intervalo para a voz e hidrate-se! 💦'
    />
  );

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {isActive && <LiveDot />}
        {running && (
          <Box component='span' sx={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums', mr: 0.5 }}>
            {moment.utc(timer * 1000).format(timer >= 3600 ? 'H:mm:ss' : 'mm:ss')}
          </Box>
        )}
        <IconButton
          color='inherit'
          aria-label={!running ? 'Iniciar show' : isActive ? 'Pausar' : 'Continuar'}
          onClick={isActive ? pause : start}
        >
          {!running ? <AccessAlarmIcon /> : isActive ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        {running && (
          <IconButton color='inherit' aria-label='Zerar' onClick={stop}>
            <AlarmOffIcon />
          </IconButton>
        )}
        {hydrationAlert}
      </Box>
    );
  }

  return <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', ml: 5 }}>
    {
      !running && <Button
        variant='outlined' color='inherit'
        startIcon={<AccessAlarmIcon />}
        onClick={isActive ? pause : start}
      >
        Iniciar Show
      </Button>
    }
    {
      running && <>
        <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          {isActive ? (
            <>
              <LiveDot />
              <Box component='span' sx={{ color: 'primary.main', fontSize: 12, fontWeight: 600, mr: 1 }}>Ao vivo</Box>
            </>
          ) : (
            <Box component='span' sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 600, mr: 1 }}>Pausado</Box>
          )}
          <Box component='span' sx={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(timer)}
          </Box>
        </Box>
        <Button
          size='small'
          variant='outlined'
          color='inherit'
          sx={{ minWidth: isActive ? 80 : 100 }}
          onClick={isActive ? pause : start}
          startIcon={isActive ? <PauseIcon /> : <PlayArrowIcon />}
        >
          {
            isActive ? 'Pausar' : 'Continuar'
          }
        </Button>
        <Button
          size='small'
          variant='text'
          color='inherit'
          sx={{ minWidth: 85 }}
          onClick={stop}
          startIcon={<AlarmOffIcon />}
        >
          Zerar
        </Button>
        {hydrationAlert}
      </>
    }
  </Box>
}

const livePulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(232, 121, 249, 0.55); }
  70% { box-shadow: 0 0 0 7px rgba(232, 121, 249, 0); }
  100% { box-shadow: 0 0 0 0 rgba(232, 121, 249, 0); }
`;

/** Pontinho pulsando de "ao vivo" enquanto o timer do show corre. */
const LiveDot = () => (
  <Box
    component='span'
    aria-hidden
    sx={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      bgcolor: 'primary.main',
      mr: 0.75,
      flexShrink: 0,
      animation: `${livePulse} 1.8s infinite`,
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    }}
  />
);
