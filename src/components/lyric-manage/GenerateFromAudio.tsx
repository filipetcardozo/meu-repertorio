import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import type { PlaybackGenerated, PlaybackType } from '../../types/playbackType';
import {
  MAX_PLAYBACK_BYTES, deletePlayback, generateCifra, processingStale, uploadPlayback, watchPlayback,
} from '../../providers/playbacks/services';
import { processingText } from '../lyric-show/Playback';
import { LyricsPicker, type LyricsChoice } from '../generate-cifra/LyricsPicker';
import { BrandIcon, Section } from './formUi';

type Props = {
  uid?: string;
  /** Música já salva (editando) ou '' (nova: o playback é ligado a ela ao salvar). */
  lyricId: string;
  /** Nome e artista do formulário (para buscar a letra). */
  lyricName: string;
  artistName: string;
  /** Cifra pronta: o formulário recebe letra, acordes, tom e andamento. */
  onGenerated: (generated: PlaybackGenerated, playbackId: string) => void;
  /** O playback enviado aqui (para o formulário ligar à música ao salvar); null se foi removido. */
  onPlayback: (playbackId: string | null) => void;
};

/**
 * "Criar pelo mp3": a letra vem da internet (ou é colada) e o áudio dá os acordes e o tempo de cada
 * palavra. Devolve a cifra pronta para revisar; o áudio fica como playback da música, já sincronizado.
 */
export function GenerateFromAudio({ uid, lyricId, lyricName, artistName, onGenerated, onPlayback }: Props) {
  const [pb, setPb] = useState<PlaybackType | null>(null);
  const [pbId, setPbId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; progress: number; cancel: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lyricsChoice, setLyricsChoice] = useState<LyricsChoice | null>(null);
  const [requesting, setRequesting] = useState(false);
  const applied = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onGeneratedRef = useRef(onGenerated);
  useEffect(() => {
    onGeneratedRef.current = onGenerated;
  });

  const input = lyricsChoice ? { lyrics: lyricsChoice.lyrics, synced: lyricsChoice.synced, source: lyricsChoice.source } : null;

  useEffect(() => {
    if (!pbId) return;
    return watchPlayback(pbId, setPb, () => setError('Não foi possível acompanhar o processamento.'));
  }, [pbId]);

  // entrega cada cifra gerada ao formulário uma vez
  useEffect(() => {
    const g = pb?.generated;
    if (pb?.id && g?.status === 'ready' && g.lyric && applied.current !== g.lyric) {
      applied.current = g.lyric;
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
        lyricId, uid, file, label: '', generate: true, generateInput: input,
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

  /** Letra trocada depois do áudio enviado: gera de novo (ou deixa para o fim do processamento). */
  const regenerate = async () => {
    if (!pb?.id) return;
    setRequesting(true);
    setError(null);
    try {
      await generateCifra(pb.id, input);
    } catch (e) {
      setError((e as Error).message || 'Não foi possível gerar a cifra.');
    } finally {
      setRequesting(false);
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
  const gen = pb?.generated?.status === 'ready' ? pb.generated : null;
  const failed = pb && !waiting && (pb.status === 'error' || pb.generated?.status === 'error' || processingStale(pb));
  // a letra escolhida agora é diferente da que foi usada (ou entregue ao servidor)
  const usedLyrics = pb?.generateInput?.lyrics ?? null;
  const lyricsChanged = !!pb && (input?.lyrics ?? null) !== usedLyrics;

  return (
    <Section
      icon={<BrandIcon><GraphicEqRoundedIcon /></BrandIcon>}
      title='Criar pelo mp3'
      subtitle='A letra vem da internet e o áudio dá os acordes e o tempo de cada palavra'
    >
      {!uid ? (
        <Typography variant='body2' sx={{ color: 'text.secondary' }}>Entre na sua conta para enviar um áudio.</Typography>
      ) : (
        <>
          <LyricsPicker
            song={lyricName ?? ''}
            artist={artistName ?? ''}
            duration={pb?.durationSec}
            value={lyricsChoice}
            onChange={setLyricsChoice}
            autoSearch
            disabled={!!upload || requesting}
          />
          <Divider sx={{ my: 2 }} />

          {upload ? (
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
                Leva alguns minutos. Enquanto isso, confira a letra e preencha os outros campos; a cifra aparece no
                formulário quando ficar pronta.
              </Typography>
              {lyricsChanged && (
                <Button size='small' sx={{ mt: 1 }} onClick={regenerate} loading={requesting}>
                  Usar esta letra quando terminar
                </Button>
              )}
            </Box>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
              {pb && lyricsChanged && (pb.status === 'ready') && (
                <Button variant='contained' onClick={regenerate} loading={requesting}>
                  Gerar de novo com esta letra
                </Button>
              )}
              <Button
                variant={pb ? 'outlined' : 'contained'}
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => fileRef.current?.click()}
              >
                {pb ? 'Usar outro mp3' : 'Escolher mp3'}
              </Button>
              {pb && <Button color='inherit' onClick={remove}>Remover áudio</Button>}
              {!pb && (
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                  mp3, m4a ou wav, até 30 MB. O áudio também fica como playback da música, já sincronizado.
                </Typography>
              )}
            </Stack>
          )}
          <input ref={fileRef} type='file' accept='audio/*,.mp3,.m4a,.wav' hidden onChange={(e) => onFile(e.target.files?.[0])} />

          {gen && !waiting && (
            <Alert severity={gen.lyricsSource === 'voice' ? 'warning' : 'success'} sx={{ mt: 2 }}>
              {gen.lyricsSource === 'voice'
                ? 'Cifra gerada com a letra reconhecida na voz, que costuma ter erros. Busque ou cole a letra acima e gere de novo.'
                : `Cifra gerada${gen.tone ? ` (tom ${gen.tone})` : ''} e colocada no formulário. Confira os acordes antes de salvar.`}
            </Alert>
          )}
          {failed && (
            <Alert severity='error' sx={{ mt: 2 }}>
              {pb?.generated?.error || pb?.error || 'O processamento parou. Tente enviar o áudio de novo.'}
            </Alert>
          )}
          {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
        </>
      )}
    </Section>
  );
}
