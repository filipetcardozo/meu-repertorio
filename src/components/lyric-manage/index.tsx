/* eslint-disable react-hooks/exhaustive-deps */
import Box from '@mui/material/Box';
import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import LyricsIcon from '@mui/icons-material/Lyrics';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import { findLyricsByName, getAllComposers, getLyric, putComposer, putLyric, updateComposerEverywhere, updateLyric } from '../../providers/lyrics/services';
import { lyricType } from '../../types/lyricType';
import { composerType } from '../../types/composerType';
import { Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UpdateIcon from '@mui/icons-material/Update';
import YouTubeIcon from '@mui/icons-material/YouTube';
import { useRouter } from 'next/router';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import EditNoteIcon from '@mui/icons-material/EditNote';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { alpha } from '@mui/material/styles';
import { Markup } from 'interweave';
import { BrandIcon, Field, Section, fieldSx } from './formUi';
import { decorateSectionTitles } from '../../utils/sectionTitles';
import { chordSheetMarksSx } from '../lyric-show/chordSheetStyles';

import { CifraClubImport, CifraImportInfo } from './CifraClubImport';
import type { CifraImport } from '../../lib/cifraClub';
import { SOURCE_LABEL, sourceOfUrl } from '../../lib/cifraSources';

const sourceName = (url?: string) => SOURCE_LABEL[(url && sourceOfUrl(url)) || 'cifraclub'];
import { monoFont } from '../../theme/createAppTheme';

const normalizeName = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const LyricManage = ({ idLyric }: { idLyric: string | undefined }) => {
  const [musicToAdd, setMusicToAdd] = useState<any>({ composerName: '', composerId: '', lyricName: '', originalTone: '', lyric: '', lyricStyle: '' })
  const [composerToAdd, setComposerToAdd] = useState<any>({ composerName: '', id: '', mainMusicStyle: '' })
  const [allComposers, setAllComposers] = useState<any>([])
  const [showStep, setShowStep] = useState<any>(0)
  // Importação do Cifra Club
  const [importedFrom, setImportedFrom] = useState<CifraImport | null>(null)
  // Artista importado que ainda não existe: é cadastrado junto com a música ao salvar
  const [pendingComposer, setPendingComposer] = useState<composerType | null>(null)
  // Artista já cadastrado que corresponde ao da importação (recebe os dados novos ao salvar)
  const [matchedComposerId, setMatchedComposerId] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<lyricType[]>([])
  const [lyricView, setLyricView] = useState<'edit' | 'preview'>('edit')
  const router = useRouter();

  const handleAddMusic = (prop: keyof any) => (event: React.ChangeEvent<HTMLInputElement>) => {
    musicToAdd[prop] = event.target.value
    setMusicToAdd({ ...musicToAdd })
  }
  const handleNumberField = (prop: 'capo' | 'bpm') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    setMusicToAdd({ ...musicToAdd, [prop]: raw === '' ? undefined : Math.max(0, Number(raw)) })
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

  const applyComposer = (target: any, composer: composerType) => {
    target.composerId = composer.id
    target.composerName = composer.composerName
    target.lyricStyle = composer.mainMusicStyle
    target.composerImage = composer.image
  }

  const findComposer = (data: CifraImport): composerType | undefined =>
    allComposers.find((c: composerType) => data.artistSlug && c.cifraClubSlug === data.artistSlug) ??
    allComposers.find((c: composerType) => normalizeName(c.composerName) === normalizeName(data.artist))

  const handleCifraImport = (data: CifraImport, info?: CifraImportInfo) => {
    // Trocar de versão de uma música que acabou de ser importada não precisa de confirmação
    if (!info?.versionSwitch && musicToAdd.lyric?.trim() && !window.confirm('Substituir a cifra que já está no formulário?')) return

    const next = {
      ...musicToAdd,
      lyricName: data.song,
      originalTone: data.tone,
      lyric: data.lyric,
      coverImage: data.coverImage,
      songwriters: data.songwriters,
      capo: data.capo,
      tuning: data.tuning,
      bpm: data.bpm,
      beatsPerBar: data.beatsPerBar,
      strummings: data.strummings,
      youtubeId: data.youtubeId,
      sourceUrl: data.url,
    }

    const composer = findComposer(data)
    if (composer) {
      // O Cifra Club é a fonte da verdade: os dados importados substituem os do cadastro
      applyComposer(next, composer)
      next.composerName = data.artist || composer.composerName
      next.composerImage = data.artistImage ?? composer.image
      next.lyricStyle = data.genre || composer.mainMusicStyle || ''
      setPendingComposer(null)
      setMatchedComposerId(composer.id ?? null)
    } else {
      setMatchedComposerId(null)
      next.composerId = ''
      next.composerName = data.artist
      next.composerImage = data.artistImage
      next.lyricStyle = data.genre ?? ''
      setPendingComposer({
        composerName: data.artist,
        mainMusicStyle: data.genre ?? '',
        image: data.artistImage,
        cifraClubSlug: data.artistSlug,
      })
    }
    setMusicToAdd(next)
    setImportedFrom(data)

    // Avisa se essa música já existe no app
    setDuplicates([])
    findLyricsByName(data.song)
      .then((found) => {
        setDuplicates(
          found.filter((l) => l.id !== idLyric && normalizeName(l.composerName) === normalizeName(data.artist))
        )
      })
      .catch(() => { /* o aviso é opcional */ })
  }

  /**
   * Garante o artista no cadastro: cria o novo ou, se for o mesmo artista da importação,
   * atualiza nome, foto, estilo e slug com os dados do Cifra Club (e replica nas músicas dele).
   */
  const ensureComposer = async (lyric: any) => {
    if (pendingComposer && !lyric.composerId) {
      const id = await putComposer(pendingComposer)
      if (!id) throw new Error('Não foi possível cadastrar o artista.')
      setAllComposers([{ ...pendingComposer, id }, ...allComposers])
      setPendingComposer(null)
      return { ...lyric, composerId: id }
    }
    const existing: composerType | undefined = allComposers.find((c: composerType) => c.id === lyric.composerId)
    // Só atualiza se o artista escolhido ainda é o que veio da importação
    if (existing?.id && importedFrom && existing.id === matchedComposerId) {
      const incoming: Partial<composerType> = {
        composerName: importedFrom.artist || undefined,
        image: importedFrom.artistImage,
        cifraClubSlug: importedFrom.artistSlug,
        mainMusicStyle: importedFrom.genre,
      }
      const patch = Object.fromEntries(
        Object.entries(incoming).filter(([k, v]) => v !== undefined && v !== (existing as any)[k])
      ) as Partial<composerType>
      if (Object.keys(patch).length && (await updateComposerEverywhere(existing.id, patch))) {
        setAllComposers(allComposers.map((c: composerType) => (c.id === existing.id ? { ...c, ...patch } : c)))
      }
    }
    return lyric
  }

  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadingAddMusic, setLoadingMusic] = useState(false)
  const addLyric = async () => {
    setLoadingMusic(true)
    setSaveError(null)
    try {
      if (!musicToAdd.composerId && !pendingComposer) throw new Error('Escolha o artista.')
      const lyric = await ensureComposer(musicToAdd)
      if (lyric !== musicToAdd) setMusicToAdd(lyric)

      if (idLyric) {
        await updateLyric(idLyric, lyric)
        setOpenAlertAddMusic(true)
      } else {
        const id = await putLyric(lyric)
        if (!id) throw new Error('Não foi possível salvar a música.')
        setOpenAlertAddMusic(true)
        router.push(`/lyric/lyric-show/${id}`)
      }
    } catch (e: any) {
      setSaveError(e?.message || 'Erro ao salvar.')
    } finally {
      setLoadingMusic(false)
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
    getOptionLabel: (option: any) => option.composerName ?? '',
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

  const handleClose = (event?: React.SyntheticEvent | Event | null, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpenAlertAddMusic(false);
    setOpenAlertAddComposer(false);

  };

  const addMusicComponent = () => {
    return (
      <>
        <CifraClubImport onImport={handleCifraImport} />
        {importedFrom && (
          <MuiAlert
            severity='success'
            sx={{ mb: 3 }}
            onClose={() => setImportedFrom(null)}
            icon={importedFrom.coverImage ? <Avatar src={importedFrom.coverImage} variant='rounded' sx={{ width: 40, height: 40 }} /> : undefined}
          >
            Cifra importada do{' '}
            <Link href={importedFrom.url} target='_blank' rel='noreferrer' color='inherit'>{sourceName(importedFrom.url)}</Link>. Revise os campos antes de salvar.
            {importedFrom.songwriters?.length ? (
              <Box component='span' sx={{ display: 'block', opacity: 0.8, fontSize: 13 }}>
                Composição: {importedFrom.songwriters.join(', ')}
              </Box>
            ) : null}
          </MuiAlert>
        )}
        {pendingComposer && !musicToAdd.composerId && (
          <MuiAlert severity='info' sx={{ mb: 3 }}>
            O artista &quot;{pendingComposer.composerName}&quot;{pendingComposer.mainMusicStyle ? ` (${pendingComposer.mainMusicStyle})` : ''} ainda não
            está cadastrado e será criado, com foto, quando você salvar a música.
          </MuiAlert>
        )}
        {importedFrom && matchedComposerId && musicToAdd.composerId === matchedComposerId && (
          <MuiAlert
            severity='info'
            sx={{ mb: 3 }}
            icon={importedFrom.artistImage ? <Avatar src={importedFrom.artistImage} sx={{ width: 28, height: 28 }} /> : undefined}
          >
            Ao salvar, o cadastro de &quot;{importedFrom.artist}&quot; será atualizado com os dados do {sourceName(importedFrom.url)}
            (foto{importedFrom.genre ? `, estilo ${importedFrom.genre}` : ''}), inclusive nas outras músicas dele.
          </MuiAlert>
        )}
        {duplicates.length > 0 && (
          <MuiAlert severity='warning' sx={{ mb: 3 }} onClose={() => setDuplicates([])}>
            Essa música já está cadastrada:{' '}
            {duplicates.map((d, i) => (
              <React.Fragment key={d.id}>
                {i > 0 && ', '}
                <Link href={`/lyric/lyric-show/${d.id}`} target='_blank' color='inherit'>
                  {d.lyricName} ({d.originalTone || 'sem tom'})
                </Link>
              </React.Fragment>
            ))}
            . Salvar vai criar outra versão.
          </MuiAlert>
        )}
        {saveError && (
          <MuiAlert severity='error' sx={{ mb: 3 }} onClose={() => setSaveError(null)}>
            {saveError}
          </MuiAlert>
        )}
        <Section
          icon={
            <Avatar
              src={musicToAdd.coverImage || musicToAdd.composerImage}
              variant='rounded'
              sx={{ width: 48, height: 48, borderRadius: '12px', bgcolor: 'action.hover', color: 'text.secondary' }}
            >
              <LyricsIcon />
            </Avatar>
          }
          title={musicToAdd.lyricName || (idLyric ? 'Editar música' : 'Nova música')}
          subtitle={
            musicToAdd.composerName
              ? [musicToAdd.composerName, musicToAdd.songwriters?.length ? `composição: ${musicToAdd.songwriters.join(', ')}` : '']
                .filter(Boolean)
                .join(' · ')
              : 'Preencha os dados ou importe pela busca'
          }
          action={
            <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>
              {musicToAdd.lyricStyle ? <Chip size='small' label={musicToAdd.lyricStyle} variant='outlined' /> : null}
              {musicToAdd.youtubeId ? (
                <Chip
                  size='small'
                  variant='outlined'
                  icon={<YouTubeIcon />}
                  label='Videoaula'
                  component='a'
                  href={`https://www.youtube.com/watch?v=${musicToAdd.youtubeId}`}
                  target='_blank'
                  clickable
                  onDelete={() => setMusicToAdd({ ...musicToAdd, youtubeId: undefined })}
                />
              ) : null}
            </Stack>
          }
        >
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Field label='Nome da música' htmlFor='lyric-name'>
                <TextField id='lyric-name' variant='outlined' fullWidth sx={fieldSx}
                  placeholder='Ex.: Tempo Perdido'
                  value={musicToAdd.lyricName} onChange={handleAddMusic('lyricName')}
                />
              </Field>
            </Grid>
            <Grid size={{ xs: 12, sm: 8, md: 5 }}>
              <Field label='Artista' htmlFor='lyric-artist'>
                <Autocomplete
                  {...defaultProps}
                  onChange={(event, newValue) => {
                    const next = { ...musicToAdd }
                    if (!newValue) {
                      next.composerId = ''
                      next.composerName = ''
                      next.lyricStyle = ''
                      next.composerImage = undefined
                    } else {
                      applyComposer(next, newValue)
                      setPendingComposer(null)
                    }
                    setMusicToAdd(next)
                  }}
                  value={musicToAdd}
                  isOptionEqualToValue={(o: any, v: any) => o.id === v.composerId}
                  noOptionsText='Nenhum artista. Importe uma música ou cadastre na aba Artista.'
                  id='lyric-artist'
                  renderOption={(props, option: any) => {
                    const { key, ...rest } = props as any
                    return (
                      <li key={option.id ?? key} {...rest}>
                        <Avatar src={option.image} sx={{ width: 28, height: 28, mr: 1.5, fontSize: 13 }}>
                          {option.composerName?.charAt(0)}
                        </Avatar>
                        {option.composerName}
                      </li>
                    )
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant='outlined'
                      placeholder='Escolha o artista'
                      sx={fieldSx}
                      slotProps={{
                        ...params.slotProps,
                        input: {
                          ...params.slotProps.input,
                          startAdornment: musicToAdd.composerName ? (
                            <InputAdornment position='start' sx={{ ml: 0.5 }}>
                              <Avatar src={musicToAdd.composerImage} sx={{ width: 26, height: 26, fontSize: 12 }}>
                                {musicToAdd.composerName?.charAt(0)}
                              </Avatar>
                            </InputAdornment>
                          ) : null,
                        },
                      }}
                    />
                  )}
                />
              </Field>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <Field label='Tom' htmlFor='lyric-tone'>
                <TextField id='lyric-tone' variant='outlined' fullWidth sx={fieldSx}
                  placeholder='Ex.: Am'
                  value={musicToAdd.originalTone} onChange={handleAddMusic('originalTone')}
                />
              </Field>
            </Grid>

            <Grid size={{ xs: 6, md: 3 }}>
              <Field label='Capotraste' htmlFor='lyric-capo'>
                <TextField id='lyric-capo' select variant='outlined' fullWidth sx={fieldSx}
                  value={musicToAdd.capo ?? ''}
                  onChange={(e) => setMusicToAdd({ ...musicToAdd, capo: e.target.value === '' ? undefined : Number(e.target.value) })}
                  slotProps={{ select: { displayEmpty: true } }}
                >
                  <MenuItem value=''><Box component='span' sx={{ color: 'text.disabled' }}>Não informado</Box></MenuItem>
                  <MenuItem value={0}>Sem capotraste</MenuItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>{n}ª casa</MenuItem>
                  ))}
                </TextField>
              </Field>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Field label='Andamento' htmlFor='lyric-bpm'>
                <TextField id='lyric-bpm' type='number' variant='outlined' fullWidth sx={fieldSx}
                  placeholder='—'
                  value={musicToAdd.bpm ?? ''} onChange={handleNumberField('bpm')}
                  slotProps={{
                    htmlInput: { min: 0, max: 300 },
                    input: { endAdornment: <InputAdornment position='end'>bpm</InputAdornment> },
                  }}
                />
              </Field>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Field label='Compasso' htmlFor='lyric-bar'>
                <TextField id='lyric-bar' select variant='outlined' fullWidth sx={fieldSx}
                  value={musicToAdd.beatsPerBar ?? ''}
                  onChange={(e) => setMusicToAdd({ ...musicToAdd, beatsPerBar: e.target.value === '' ? undefined : Number(e.target.value) })}
                  slotProps={{ select: { displayEmpty: true } }}
                >
                  <MenuItem value=''><Box component='span' sx={{ color: 'text.disabled' }}>Não informado</Box></MenuItem>
                  {[2, 3, 4, 6].map((n) => (
                    <MenuItem key={n} value={n}>{n} tempos</MenuItem>
                  ))}
                </TextField>
              </Field>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Field label='Afinação' htmlFor='lyric-tuning' hint={musicToAdd.tuning === 'E A D G B E' ? 'padrão' : undefined}>
                <TextField id='lyric-tuning' variant='outlined' fullWidth sx={fieldSx}
                  placeholder='E A D G B E'
                  value={musicToAdd.tuning ?? ''} onChange={handleAddMusic('tuning')}
                />
              </Field>
            </Grid>
          </Grid>
        </Section>

        <Section
          icon={<BrandIcon><HistoryEduIcon /></BrandIcon>}
          title='Cifra'
          subtitle={lyricView === 'edit' ? 'Acordes entre <b> e </b>, tablaturas em <span class="tablatura">' : 'Como vai aparecer no show'}
          action={
            <ToggleButtonGroup
              size='small'
              exclusive
              value={lyricView}
              onChange={(_, v) => v && setLyricView(v)}
              sx={{ '& .MuiToggleButton-root': { px: 1.5, gap: 0.75, borderRadius: '10px' } }}
            >
              <ToggleButton value='edit'><EditNoteIcon fontSize='small' />Editar</ToggleButton>
              <ToggleButton value='preview'><VisibilityIcon fontSize='small' />Visualizar</ToggleButton>
            </ToggleButtonGroup>
          }
        >
          {lyricView === 'edit' ? (
            <TextField
              id='lyric-body'
              variant='outlined'
              multiline
              fullWidth
              minRows={16}
              placeholder='Cole aqui a cifra (ou importe pela busca)'
              value={musicToAdd.lyric}
              onChange={handleAddMusic('lyric')}
              spellCheck={false}
              sx={(theme) => ({
                ...fieldSx(theme),
                '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': {
                  ...monoFont,
                  fontSize: 14,
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  letterSpacing: 0,
                  tabSize: 2,
                  lineHeight: 1.45,
                },
              })}
            />
          ) : (
            <Box
              sx={(theme) => ({
                minHeight: 320,
                maxHeight: '70vh',
                overflow: 'auto',
                p: 2,
                borderRadius: '12px',
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025),
                ...monoFont,
                fontSize: 14,
                lineHeight: 1.45,
                '& pre': { fontFamily: 'inherit', fontSize: 'inherit', m: 0, whiteSpace: 'pre' },
                '& b': { color: 'chord.main' },
                ...chordSheetMarksSx(theme),
                '& .tablatura': { color: 'text.secondary' },
              })}
            >
              {musicToAdd.lyric?.trim() ? (
                <Markup content={decorateSectionTitles(musicToAdd.lyric)} />
              ) : (
                <Typography sx={{ color: 'text.disabled', fontFamily: 'inherit' }}>Nada para mostrar ainda.</Typography>
              )}
            </Box>
          )}
        </Section>
        <Box sx={{ height: 72 }} />

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
          <Grid size={6}>
            <TextField id='filled-basic' label='Nome do Artista' variant='filled' name='composerName' fullWidth
              value={composerToAdd.composerName} onChange={handleAddComposer}
            />
          </Grid>
          <Grid size={6}>
            <TextField id='filled-basic' label='Estilo musical' variant='filled' name='mainMusicStyle' fullWidth
              value={composerToAdd.mainMusicStyle} onChange={handleAddComposer}
            />
          </Grid>
          <Grid sx={{ textAlign: 'center' }} size={12}>
            <Button variant='outlined' onClick={addComposer} loading={loadingAddComposer}>Adicionar artista</Button>
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
