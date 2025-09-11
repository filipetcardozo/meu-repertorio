/* eslint-disable react-hooks/exhaustive-deps */
import Box from '@mui/material/Box';
import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container';
import LoadingButton from '@mui/lab/LoadingButton';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import LyricsIcon from '@mui/icons-material/Lyrics';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { getAllComposers, getLyric, putComposer, putLyric, updateLyric } from '../../providers/lyrics/services';
import { lyricType } from '../../types/lyricType';
import { Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UpdateIcon from '@mui/icons-material/Update';
import { useRouter } from 'next/router';

export const LyricManage = ({ idLyric }: { idLyric: string | undefined }) => {
  const [musicToAdd, setMusicToAdd] = useState<any>({ composerName: '', composerId: '', lyricName: '', originalTone: '', lyric: '', lyricStyle: '' })
  const [composerToAdd, setComposerToAdd] = useState<any>({ composerName: '', id: '', mainMusicStyle: '' })
  const [allComposers, setAllComposers] = useState<any>([])
  const [showStep, setShowStep] = useState<any>(0)
  const router = useRouter();

  const handleAddMusic = (prop: keyof any) => (event: React.ChangeEvent<HTMLInputElement>) => {
    musicToAdd[prop] = event.target.value
    setMusicToAdd({ ...musicToAdd })
  }
  const handleAddComposer = (event: any) => {
    composerToAdd[event.target.name] = event.target.value
    setComposerToAdd({ ...composerToAdd })
  }

  useEffect(() => {
    getAllComposers().then((value: any) => {
      setAllComposers(value)
    })
  }, [])

  useEffect(() => {
    if (idLyric) {
      getLyric(idLyric)
        .then((v: lyricType) => {
          if (v) {
            setMusicToAdd(v)
          }
        })
    }
  }, [])

  const [loadingAddMusic, setLoadingMusic] = useState(false)
  const addLyric = async () => {
    setLoadingMusic(true)
    if (idLyric) {
      updateLyric(idLyric, musicToAdd)
        .then(() => {
          setOpenAlertAddMusic(true);
          setLoadingMusic(false);
        })
    } else {
      putLyric(musicToAdd).then((value: any) => {
        if (value) {
          setOpenAlertAddMusic(true)
          setLoadingMusic(false)
          router.push(`/lyric/lyric-show/${value}`)
        }
      })
    }

  }
  const [loadingAddComposer, setLoadingComposer] = useState(false)
  const addComposer = async () => {
    setLoadingComposer(true)
    delete composerToAdd.id
    putComposer(composerToAdd).then((value) => {
      if (value) {
        composerToAdd.id = value
        allComposers.unshift(composerToAdd)
        setComposerToAdd({ ...composerToAdd })
        setOpenAlertAddComposer(true)
        setLoadingComposer(false)
      }
    })
  }

  const defaultProps = {
    options: allComposers,
    getOptionLabel: (option: any) => option.composerName,
  };

  // Alert
  const [openAlertAddMusic, setOpenAlertAddMusic] = React.useState(false);
  const [openAlertAddComposer, setOpenAlertAddComposer] = React.useState(false)
  const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref,
  ) {
    return <MuiAlert elevation={6} ref={ref} variant='filled' {...props} />;
  });

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpenAlertAddMusic(false);
    setOpenAlertAddComposer(false);

  };

  const addMusicComponent = () => {
    return (
      <>
        <Grid container spacing={4} mb={10}>
          <Grid item xs={4}>
            <Autocomplete
              {...defaultProps}
              onChange={(event, newValue) => {
                if (!newValue) {
                  musicToAdd.composerId = ''
                  musicToAdd.composerName = ''
                  musicToAdd.lyricStyle = ''
                } else {
                  musicToAdd.composerId = newValue.id
                  musicToAdd.composerName = newValue.composerName
                  musicToAdd.lyricStyle = newValue.mainMusicStyle
                }

                setMusicToAdd({ ...musicToAdd })
              }}
              value={musicToAdd}
              noOptionsText='Nenhuma opção.'
              disablePortal
              id='demo-simple-select-filled'
              renderInput={(params) => <TextField {...params} label='Artista' variant='filled' />}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField id='filled-basic' label='Nome da música' variant='filled' name='lyricName' fullWidth
              value={musicToAdd.lyricName} onChange={handleAddMusic('lyricName')}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField id='filled-basic' label='Tom' variant='filled' name='originalTone' fullWidth
              value={musicToAdd.originalTone} onChange={handleAddMusic('originalTone')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              id='filled-basic'
              label='Cifra'
              variant='filled'
              name='lyric'
              multiline
              fullWidth
              minRows={12}
              value={musicToAdd.lyric}
              onChange={handleAddMusic('lyric')}
              spellCheck={false}
              sx={{
                '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': {
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontVariantLigatures: 'none',
                  whiteSpace: 'pre',
                  letterSpacing: 0,
                  tabSize: 2,
                  lineHeight: 1.2,
                },
              }}
            />
          </Grid>
        </Grid>

        <Fab
          color='primary'
          aria-label={idLyric ? 'Atualizar música' : 'Adicionar música'}
          variant='extended'
          size='small'
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
          onClick={addLyric}
          disabled={loadingAddMusic}
        >
          <Box sx={{ mr: 1, position: 'relative', top: 4 }}>{idLyric ? <UpdateIcon /> : <AddIcon />}</Box>
          {idLyric ? 'Atualizar música' : 'Adicionar música'}
        </Fab>

        <Snackbar open={openAlertAddMusic} autoHideDuration={6000} onClose={handleClose}>
          <Alert onClose={handleClose} severity='success' sx={{ width: '100%' }}>
            Música adicionada com sucesso!
          </Alert>
        </Snackbar>
      </>
    )
  }

  const addComposerComponent = () => {
    return (
      <>
        <Grid container spacing={4}>
          <Grid item xs={6}>
            <TextField id='filled-basic' label='Nome do Artista' variant='filled' name='composerName' fullWidth
              value={composerToAdd.composerName} onChange={handleAddComposer}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField id='filled-basic' label='Estilo musical' variant='filled' name='mainMusicStyle' fullWidth
              value={composerToAdd.mainMusicStyle} onChange={handleAddComposer}
            />
          </Grid>
          <Grid item xs={12} textAlign='center'>
            <LoadingButton variant='outlined' onClick={addComposer} loading={loadingAddComposer}>Adicionar artista</LoadingButton>
          </Grid>
        </Grid>
        <Snackbar open={openAlertAddComposer} autoHideDuration={6000} onClose={handleClose}>
          <Alert onClose={handleClose} severity='success' sx={{ width: '100%' }}>
            Artista adicionado com sucesso!
          </Alert>
        </Snackbar>
      </>
    )
  }

  return (
    <Container maxWidth={'lg'}>
      <Box sx={{ my: 2 }}>
        <BottomNavigation
          showLabels
          value={showStep}
          onChange={(event, newValue) => {
            setShowStep(newValue);
          }}
        >
          <BottomNavigationAction label='Adicionar Música' icon={<LyricsIcon />} />
          <BottomNavigationAction label='Adicionar Artista' icon={<HistoryEduIcon />} />
        </BottomNavigation>

      </Box>
      <Box
        component='form'
        noValidate
        autoComplete='off'
      >
        {showStep == 0 ? addMusicComponent() : ''}
        {showStep == 1 ? addComposerComponent() : ''}
      </Box>
    </Container>
  )
}