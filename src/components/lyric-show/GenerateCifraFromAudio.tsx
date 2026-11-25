import React, { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useRouter } from 'next/router';
import { enqueueSnackbar } from 'notistack';
import type { lyricType } from '../../types/lyricType';
import type { PlaybackType } from '../../types/playbackType';
import { getLyric, putLyric, updateLyric } from '../../providers/lyrics/services';
import {
  MAX_PLAYBACK_BYTES, generateCifra, processingStale, resyncPlayback, uploadPlayback, watchPlaybacks,
} from '../../providers/playbacks/services';
import { GeneratedCifraPreview } from '../generate-cifra/GeneratedCifraPreview';
import { LyricsPicker, type LyricsChoice } from '../generate-cifra/LyricsPicker';
import { processingText } from './Playback';
import { displayFontFamily } from '../../theme/createAppTheme';

type Props = {
  lyricId: string;
  uid?: string;
  hasUnsavedOffset?: boolean;
  saveOffset?: () => Promise<void> | void;
  size?: 'small' | 'medium';
};

/** Botão "Gerar cifra pelo áudio": a plataforma ouve um playback da música e escreve acordes e letra. */
export const GenerateCifraFromAudioButton = (props: Props) => {
  const [open, setOpen] = useState(false);
  if (!props.uid) return null;
  return (
    <>
      <Tooltip title='Gerar cifra pelo áudio'>
        <IconButton aria-label='gerar cifra pelo áudio' onClick={() => setOpen(true)} color='inherit' size={props.size}>
          <GraphicEqRoundedIcon color='primary' fontSize={props.size} />
        </IconButton>
      </Tooltip>
      {open && <GenerateDialog {...props} uid={props.uid} onClose={() => setOpen(false)} />}
    </>
  );
};

const GenerateDialog = ({ lyricId, uid, hasUnsavedOffset, saveOffset, onClose }: Props & { uid: string; onClose: () => void }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();
  const [lyric, setLyric] = useState<lyricType | null>(null);
  const [list, setList] = useState<PlaybackType[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState<'version' | 'replace' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; progress: number; cancel: () => void } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lyricsChoice, setLyricsChoice] = useState<LyricsChoice | null>(null);
  const [showLyrics, setShowLyrics] = useState(true);
  const input = lyricsChoice ? { lyrics: lyricsChoice.lyrics, synced: lyricsChoice.synced, source: lyricsChoice.source } : null;

  useEffect(() => {
    getLyric(lyricId)
      .then((l) => (l ? setLyric({ ...l, id: lyricId }) : setError('Música não encontrada.')))
      .catch(() => setError('Não foi possível carregar a música.'));
    return watchPlaybacks(lyricId, uid, setList, () => setError('Não foi possível carregar os áudios.'));
  }, [lyricId, uid]);

  // sem escolha: um com cifra gerada, senão o primeiro pronto
  const picked = list?.find((p) => p.id === pickedId)
    ?? list?.find((p) => p.generated?.status === 'ready')
    ?? list?.find((p) => p.status === 'ready')
    ?? list?.[0]
    ?? null;
  const generated = picked?.generated?.status === 'ready' && picked.generated.lyric ? picked.generated : null;
  const waiting = !!picked && (picked.status === 'processing' || picked.status === 'uploading') && !processingStale(picked);

  const request = async (p: PlaybackType) => {
    if (!p.id) return;
    setRequesting(true);
    setError(null);
    try {
      await generateCifra(p.id, input);
      setShowLyrics(false);
    } catch (e) {
      setError((e as Error).message || 'Não foi possível gerar a cifra.');
    } finally {
      setRequesting(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PLAYBACK_BYTES) {
      setError('O arquivo passa de 30 MB.');
      return;
    }
    setError(null);
    setUpload({ name: file.name, progress: 0, cancel: () => undefined });
    try {
      const h = await uploadPlayback({
        lyricId, uid, file, label: '', generate: true, generateInput: input,
        onProgress: (p) => setUpload((u) => (u ? { ...u, progress: p } : u)),
      });
      setUpload((u) => (u ? { ...u, cancel: h.cancel } : u));
      setPickedId(h.id);
      await h.done;
    } catch (e) {
      setError((e as Error).message || 'Não foi possível enviar o áudio.');
    } finally {
      setUpload(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fromGenerated = (base: lyricType): lyricType => ({
    ...base,
    lyric: generated!.lyric!,
    originalTone: generated!.tone || base.originalTone,
    bpm: generated!.bpm ?? base.bpm,
    generatedFromAudio: true,
  });

  const saveAsVersion = async () => {
    if (!lyric || !generated) return;
    setSaving('version');
    setError(null);
    try {
      // versão nova: sem os dados que vieram da cifra de origem (batida, link)
      const { id: _id, sourceUrl: _src, strummings: _st, compactView: _cv, ...base } = lyric;
      const id = await putLyric(fromGenerated(base as lyricType));
      if (!id) throw new Error('Não foi possível salvar a nova versão.');
      enqueueSnackbar('Nova versão salva. Revise os acordes e a letra quando puder.', { variant: 'success' });
      router.push(`/lyric/lyric-show/${id}`);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Não foi possível salvar.');
      setSaving(null);
    }
  };

  const replace = async () => {
    if (!lyric?.id || !generated || !picked?.id) return;
    if (!window.confirm('Substituir a cifra desta música pela gerada? A cifra atual será perdida.')) return;
    setSaving('replace');
    setError(null);
    try {
      if (hasUnsavedOffset && saveOffset) await saveOffset();
      await updateLyric(lyric.id, fromGenerated(lyric));
      await resyncPlayback(picked.id).catch(() => undefined); // a sincronia passa a usar a cifra nova
      window.location.reload();
    } catch (e) {
      setError((e as Error).message || 'Não foi possível salvar.');
      setSaving(null);
    }
  };

  const busy = !!saving || !!upload;

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth={generated ? 'md' : 'sm'} fullScreen={fullScreen}>
      <DialogTitle sx={{ fontFamily: displayFontFamily, fontWeight: 600, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <GraphicEqRoundedIcon color='primary' fontSize='small' />
        Gerar cifra pelo áudio
      </DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Typography variant='body2' sx={{ color: 'text.secondary', mb: 2 }}>
          A plataforma ouve o áudio e reconhece os acordes; a letra vem da internet (ou você cola) e é encaixada
          no tempo em que é cantada. Você vê o resultado antes e escolhe: salvar como nova versão ou substituir a cifra.
        </Typography>

        {list === null ? (
          <LinearProgress sx={{ borderRadius: 4 }} />
        ) : (
          <>
            {list.length > 0 && (
              <TextField
                select
                fullWidth
                size='small'
                label='Áudio'
                value={picked?.id ?? ''}
                onChange={(e) => setPickedId(e.target.value)}
                sx={{ mb: 2 }}
                disabled={busy}
              >
                {list.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.label || p.fileName}
                    {p.generated?.status === 'ready' ? ' · cifra gerada' : ''}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {upload ? (
              <Box sx={{ py: 1 }}>
                <Typography noWrap sx={{ fontSize: 13, mb: 1 }}>Enviando {upload.name}… {Math.round(upload.progress * 100)}%</Typography>
                <Stack direction='row' sx={{ alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant='determinate' value={upload.progress * 100} sx={{ flex: 1 }} />
                  <Button size='small' color='inherit' onClick={upload.cancel}>Cancelar</Button>
                </Stack>
              </Box>
            ) : (
              <Button
                size='small'
                variant={list.length ? 'text' : 'contained'}
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => fileRef.current?.click()}
                sx={{ mb: 2 }}
              >
                {list.length ? 'Usar outro mp3' : 'Enviar o mp3 da música'}
              </Button>
            )}
            <input ref={fileRef} type='file' accept='audio/*,.mp3,.m4a,.wav' hidden onChange={(e) => onFile(e.target.files?.[0])} />

            {picked && waiting && (
              <Box sx={{ py: 1 }}>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>
                  {picked.status === 'uploading' ? 'Enviando o áudio…' : processingText(picked)}
                </Typography>
                <LinearProgress
                  variant={picked.status === 'processing' && picked.stage && picked.stage !== 'queued' ? 'determinate' : 'indeterminate'}
                  value={(picked.progress ?? 0) * 100}
                  sx={{ borderRadius: 4, height: 6 }}
                />
                <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  {picked.generate
                    ? 'A cifra fica pronta no fim do processamento (alguns minutos). Pode fechar esta janela e voltar depois.'
                    : 'Espere o processamento terminar para gerar a cifra.'}
                </Typography>
              </Box>
            )}

            {picked?.generated?.status === 'error' && !waiting && (
              <Alert severity='error' sx={{ mb: 1.5 }}>{picked.generated.error || 'Não foi possível gerar a cifra.'}</Alert>
            )}
            {picked?.status === 'error' && !waiting && (
              <Alert severity='error' sx={{ mb: 1.5 }}>{picked.error || 'O processamento deste áudio falhou.'}</Alert>
            )}

            {lyric && (showLyrics || !generated) && !waiting && (
              <Box sx={{ mb: 2 }}>
                <LyricsPicker
                  song={lyric.lyricName}
                  artist={lyric.composerName}
                  duration={picked?.durationSec}
                  value={lyricsChoice}
                  onChange={setLyricsChoice}
                  autoSearch
                  disabled={busy || requesting}
                />
              </Box>
            )}
            {generated && !waiting && !showLyrics && (
              <Button size='small' color='inherit' onClick={() => setShowLyrics(true)} sx={{ mb: 1 }}>
                Trocar a letra e gerar de novo
              </Button>
            )}
            {generated && !waiting && generated.lyricsSource === 'voice' && (
              <Alert severity='warning' sx={{ mb: 1.5 }}>
                Esta versão usou a letra reconhecida na voz, que costuma ter erros. Busque a letra acima e gere de novo.
              </Alert>
            )}
            {generated && !waiting && <GeneratedCifraPreview generated={generated} />}
          </>
        )}

        {error && <Alert severity='error' sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} disabled={busy} color='inherit' sx={{ mr: 'auto' }}>
          Fechar
        </Button>
        {picked && !waiting && (!generated || showLyrics) && (picked.status === 'ready' || picked.status === 'error') && (
          <Button variant={generated ? 'outlined' : 'contained'} onClick={() => request(picked)} loading={requesting} disabled={busy}>
            {generated ? 'Gerar de novo' : 'Gerar cifra'}
          </Button>
        )}
        {generated && !waiting && (
          <>
            <Button variant='outlined' onClick={replace} loading={saving === 'replace'} disabled={busy}>
              Substituir a cifra
            </Button>
            <Button variant='contained' onClick={saveAsVersion} loading={saving === 'version'} disabled={busy}>
              Salvar como nova versão
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
