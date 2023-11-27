import { useEffect, useState } from 'react';
import { useShowTimer } from '../../hooks/useShowTimer';
import { Alert, Box, Button, Grow, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrowOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import moment from 'moment'
import { styled, keyframes } from '@mui/system';

export const ShowTimer = () => {
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

  return <Box sx={{ ml: 5 }} display='flex' gap={2} alignItems='center'>
    {
      (timer <= 0 && !isActive) && <Button
        variant='contained' color='info'
        startIcon={<AccessAlarmIcon />}
        onClick={isActive ? pause : start}
      >
        Iniciar Show
      </Button>
    }
    {
      (timer > 0 || isActive) && <>
        <Box sx={{ ml: 1, display: 'inline', fontWeight: 'bold' }}>
          {formatTime(timer)}
        </Box>
        <Button
          size='small'
          variant='contained'
          color='info'
          onClick={isActive ? pause : start}
          startIcon={isActive ? <PauseIcon /> : <PlayArrowIcon />}
        >
          {
            isActive ? 'Pausar' : 'Continuar'
          }
        </Button>
        <Button
          size='small'
          variant='contained'
          color='secondary'
          onClick={stop}
          startIcon={<AlarmOffIcon />}
        >
          Zerar
        </Button>
        <Grow in={showAlert}>
          <PulsatingTypography variant='h6' fontSize={16} color='white' ml={2}>
            🌊 Onda de Hidratação! 🎤 Dê um intervalo para a voz e hidrate-se! 💦
          </PulsatingTypography>
        </Grow>
      </>
    }
  </Box>
}

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

const PulsatingTypography = styled(Typography)({
  animation: `${pulse} 2s infinite`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  fontWeight: 'bold',
});
