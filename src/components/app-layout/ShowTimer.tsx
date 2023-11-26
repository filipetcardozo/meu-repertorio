import { useShowTimer } from '../../hooks/useShowTimer';
import { Box, Button, IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrowOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import moment from 'moment'

export const ShowTimer = () => {
  const { timer, start, pause, stop, isActive } = useShowTimer();

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
      </>
    }
  </Box>
}