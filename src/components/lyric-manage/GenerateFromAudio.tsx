import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import type { PlaybackGenerated, PlaybackType } from '../../types/playbackType';
import { MAX_PLAYBACK_BYTES, deletePlayback, processingStale, uploadPlayback, watchPlayback } from '../../providers/playbacks/services';
import { processingText } from '../lyric-show/Playback';
import { BrandIcon, Section } from './formUi';

type Props = {
  uid?: string;
  /** Música já salva (editando) ou '' (nova: o playback é ligado a ela ao salvar). */
  lyricId: string;
  /** Cifra pronta: o formulário recebe letra, acordes, tom e andamento. */
  onGenerated: (generated: PlaybackGenerated, playbackId: string) => void;
  /** O playback enviado aqui (para o formulário ligar à música ao salvar); null se foi removido. */
  onPlayback: (playbackId: string | null) => void;
};

/**
 * "Criar pelo mp3": envia o áudio, a plataforma separa os instrumentos, reconhece a letra e os acordes
 * e devolve a cifra pronta para revisar. O áudio fica como playback da música, já sincronizado.
 */
export function GenerateFromAudio({ uid, lyricId, onGenerated, onPlayback }: Props) {
  const [pb, setPb] = useState<PlaybackType | null>(null);
  const [pbId, setPbId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; progress: number; cancel: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applied = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onGeneratedRef = useRef(onGenerated);
  useEffect(() => {
    onGeneratedRef.current = onGenerated;
  });

  useEffect(() => {
    if (!pbId) return;
    return watchPlayback(pbId, setPb, () => setError('Não foi possível acompanhar o processamento.'));
  }, [pbId]);

  // entrega a cifra ao formulário uma vez por playback
  useEffect(() => {
    const g = pb?.generated;
    if (pb?.id && g?.status === 'ready' && g.lyric && applied.current !== pb.id) {
      applied.current = pb.id;
      onGeneratedRef.current(g, pb.id);
    }
  }, [pb]);

  const onFile = async (file: File | undefined) => {
    if (!file || !uid) return;
    if (file.size > MAX_PLAYBACK_BYTES) {
      setError('O arquivo passa de 30 MB.');
      return;
    }
    setError(null);
    setUpload({ name: file.name, progress: 0, cancel: () => undefined });
    try {
      const h = await uploadPlayback({
        lyricId, uid, file, label: '', generate: true,
        onProgress: (p) => setUpload((u) => (u ? { ...u, progress: p } : u)),
      });
      setUpload((u) => (u ? { ...u, cancel: h.cancel } : u));
      setPbId(h.id);
      onPlayback(h.id);
      await h.done;
    } catch (e) {
      setPbId(null);
      onPlayback(null);
      setError((e as Error).message || 'Não foi possível enviar o áudio.');
    } finally {
      setUpload(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    const cur = pb;
    setPbId(null);
    setPb(null);
    onPlayback(null);
    applied.current = null;
    if (cur?.id && !cur.lyricId) await deletePlayback(cur).catch(() => undefined);
  };

  const waiting = !!pb && (pb.status === 'uploading' || pb.status === 'processing') && !processingStale(pb);
  const done = pb?.generated?.status === 'ready';
  const failed = pb && !waiting && (pb.status === 'error' || pb.generated?.status === 'error' || processingStale(pb));

  return (
    <Section
      icon={<BrandIcon><GraphicEqRoundedIcon /></BrandIcon>}
      title='Criar pelo mp3'
      subtitle='Envie o áudio e a plataforma escreve a letra e os acordes para você revisar'
    >
      {!uid ? (
        <Typography variant='body2' sx={{ color: 'text.secondary' }}>Entre na sua conta para enviar um áudio.</Typography>
      ) : upload ? (
        <Box>
          <Typography noWrap sx={{ fontSize: 13, mb: 1 }}>Enviando {upload.name}… {Math.round(upload.progress * 100)}%</Typography>
          <Stack direction='row' sx={{ alignItems: 'center', gap: 1 }}>
            <LinearProgress variant='determinate' value={upload.progress * 100} sx={{ flex: 1 }} />
            <Button size='small' color='inherit' onClick={upload.cancel}>Cancelar</Button>
          </Stack>
        </Box>
      ) : waiting ? (
        <Box>
          <Typography sx={{ fontWeight: 500, mb: 1 }}>{pb.status === 'uploading' ? 'Enviando o áudio…' : processingText(pb)}</Typography>
          <LinearProgress
            variant={pb.stage && pb.stage !== 'queued' ? 'determinate' : 'indeterminate'}
            value={(pb.progress ?? 0) * 100}
            sx={{ borderRadius: 4, height: 6 }}
          />
          <Typography variant='caption' sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Leva alguns minutos. Enquanto isso, preencha o nome e o artista; a cifra aparece aqui embaixo quando ficar pronta.
          </Typography>
        </Box>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: { sm: 'center' } }}>
          <Button
            variant={done ? 'outlined' : 'contained'}
            startIcon={<UploadFileRoundedIcon />}
            onClick={() => fileRef.current?.click()}
          >
            {pb ? 'Usar outro mp3' : 'Escolher mp3'}
          </Button>
          {pb && (
            <Button color='inherit' onClick={remove}>Remover áudio</Button>
          )}
          {!pb && (
            <Typography variant='body2' sx={{ color: 'text.secondary' }}>
              mp3, m4a ou wav, até 30 MB. O áudio também fica como playback da música, já sincronizado.
            </Typography>
          )}
        </Stack>
      )}
      <input ref={fileRef} type='file' accept='audio/*,.mp3,.m4a,.wav' hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {done && !waiting && (
        <Alert severity='success' sx={{ mt: 2 }}>
          Cifra gerada{pb?.generated?.tone ? ` (tom ${pb.generated.tone})` : ''} e colocada no formulário. É um rascunho:
          confira os acordes e a letra antes de salvar.
        </Alert>
      )}
      {failed && (
        <Alert severity='error' sx={{ mt: 2 }}>
          {pb?.generated?.error || pb?.error || 'O processamento parou. Tente enviar o áudio de novo.'}
        </Alert>
      )}
      {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
    </Section>
  );
}
