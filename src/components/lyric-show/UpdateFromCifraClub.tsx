import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { Markup } from 'interweave';
import type { CifraImport } from '../../lib/cifraClub';
import type { lyricType } from '../../types/lyricType';
import type { composerType } from '../../types/composerType';
import { getAllComposers, getLyric, putComposer, updateComposerEverywhere, updateLyric } from '../../providers/lyrics/services';
import { ArtistAvatar } from '../ArtistAvatar';
import { decorateSectionTitles } from '../../utils/sectionTitles';
import { chordSheetMarksSx } from './chordSheetStyles';
import { CifraClubImport } from '../lyric-manage/CifraClubImport';
import { displayFontFamily, monoFont } from '../../theme/createAppTheme';
import { writeTone } from '../../utils/writeTone';
import { SOURCE_LABEL, sourceOfUrl } from '../../lib/cifraSources';

const sourceName = (url?: string) => SOURCE_LABEL[(url && sourceOfUrl(url)) || 'cifraclub'];

const normalizeName = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "Só Pra Contrariar" ≈ "Só Pra Contrariar (SPC)": ignora o que está entre parênteses e aceita um contido no outro. */
const looselySameName = (a: string, b: string) => {
  const strip = (s: string) => normalizeName((s ?? '').replace(/\([^)]*\)/g, ' '));
  const x = strip(a);
  const y = strip(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

/** O que fazer com o artista quando o do Cifra Club tem outro nome. */
type ArtistMode = 'update' | 'switch' | 'keep';

type Props = {
  lyricId: string;
  lyricName: string;
  composerName: string;
  /** Ajuste de tom do usuário (não muda com a atualização) */
  offset: number;
  /** Há ajuste de tom ainda não salvo: é salvo antes de recarregar */
  hasUnsavedOffset?: boolean;
  saveOffset?: () => Promise<void> | void;
  size?: 'small' | 'medium';
};

/** Botão + diálogo que busca a música no Cifra Club e substitui a cifra, mantendo o ajuste de tom. */
export const UpdateFromCifraClubButton = (props: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title='Atualizar cifra (Cifra Club, Cifras.com.br, Ultimate Guitar)'>
        <IconButton aria-label='atualizar cifra' onClick={() => setOpen(true)} color='inherit' size={props.size}>
          <CloudSyncIcon color='primary' fontSize={props.size} />
        </IconButton>
      </Tooltip>
      {open && <UpdateFromCifraClubDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
};

const ArtistOption = ({
  value,
  avatar,
  title,
  hint,
}: {
  value: ArtistMode;
  avatar: React.ReactNode;
  title: React.ReactNode;
  hint: string;
}) => (
  <FormControlLabel
    value={value}
    control={<Radio size='small' />}
    sx={{ alignItems: 'center', mr: 0, py: 0.25 }}
    label={
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        {avatar}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{title}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.3 }}>{hint}</Typography>
        </Box>
      </Box>
    }
  />
);

const capoLabel = (c?: number) => (c === undefined ? '' : c === 0 ? 'sem capotraste' : `capotraste na ${c}ª casa`);

const UpdateFromCifraClubDialog = ({
  lyricId,
  offset,
  hasUnsavedOffset,
  saveOffset,
  onClose,
}: Props & { onClose: () => void }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [lyric, setLyric] = useState<lyricType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<CifraImport | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [composers, setComposers] = useState<composerType[] | null>(null);
  const [artistMode, setArtistMode] = useState<ArtistMode>('update');

  useEffect(() => {
    Promise.all([getLyric(lyricId), getAllComposers()])
      .then(([l, list]) => {
        setComposers(list);
        if (l) setLyric({ ...l, id: lyricId });
        else setLoadError('Música não encontrada.');
      })
      .catch(() => setLoadError('Não foi possível carregar a música.'));
  }, [lyricId]);

  const currentComposer = composers?.find((c) => c.id === lyric?.composerId);
  /** Artista do Cifra Club já cadastrado no app (pelo slug ou pelo nome), se for outro que não o atual */
  const findTarget = (d: CifraImport) =>
    composers?.find((c) => c.id !== lyric?.composerId && !!d.artistSlug && c.cifraClubSlug === d.artistSlug) ??
    composers?.find((c) => c.id !== lyric?.composerId && normalizeName(c.composerName) === normalizeName(d.artist));
  const targetComposer = data ? findTarget(data) : undefined;
  const artistDiffers =
    !!data && !!lyric && (normalizeName(data.artist) !== normalizeName(lyric.composerName) || !!targetComposer);

  const handleImport = (d: CifraImport) => {
    setData(d);
    // Sugestão: mesmo artista com outro nome → atualizar; outro artista → mover a música para ele
    const same =
      (!!d.artistSlug && currentComposer?.cifraClubSlug === d.artistSlug) ||
      (!!lyric && looselySameName(d.artist, lyric.composerName));
    setArtistMode(same && !findTarget(d) ? 'update' : 'switch');
  };

  const toneBefore = writeTone({ originalTone: lyric?.originalTone, offset });
  const toneAfter = data ? writeTone({ originalTone: data.tone, offset }) : null;
  const toneChanged = !!toneBefore && !!toneAfter && toneBefore !== toneAfter;

  const confirm = async () => {
    if (!data || !lyric?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      // O ajuste de tom fica no cadastro do usuário, não na música: só garante que o atual está salvo.
      if (hasUnsavedOffset && saveOffset) await saveOffset();

      // Dados do artista vindos do Cifra Club; só grava o que mudou
      const incoming: Partial<composerType> = {
        composerName: data.artist || undefined,
        image: data.artistImage,
        cifraClubSlug: data.artistSlug,
        mainMusicStyle: data.genre,
      };
      const patchFor = (c: composerType) =>
        Object.fromEntries(
          Object.entries(incoming).filter(([k, v]) => v !== undefined && v !== (c as any)[k]),
        ) as Partial<composerType>;

      let composerId = lyric.composerId;
      let composerName = lyric.composerName;
      let composerImage = lyric.composerImage;
      let lyricStyle = lyric.lyricStyle || data.genre || '';
      const mode: ArtistMode = artistDiffers ? artistMode : 'update';

      if (mode === 'update' && currentComposer?.id) {
        // Mesmo artista: atualiza nome, foto, estilo e slug (e replica nas músicas dele)
        const patch = patchFor(currentComposer);
        if (Object.keys(patch).length) await updateComposerEverywhere(currentComposer.id, patch);
        composerName = data.artist || composerName;
        composerImage = data.artistImage ?? currentComposer.image ?? composerImage;
      } else if (mode === 'switch' || (mode === 'update' && !currentComposer)) {
        // Música passa para o artista do Cifra Club (o existente, atualizado, ou um novo)
        if (targetComposer?.id) {
          const patch = patchFor(targetComposer);
          if (Object.keys(patch).length) await updateComposerEverywhere(targetComposer.id, patch);
          composerId = targetComposer.id;
          composerName = data.artist || targetComposer.composerName;
          composerImage = data.artistImage ?? targetComposer.image;
          lyricStyle = data.genre || targetComposer.mainMusicStyle || lyricStyle;
        } else {
          const id = await putComposer({
            composerName: data.artist,
            mainMusicStyle: data.genre ?? '',
            image: data.artistImage,
            cifraClubSlug: data.artistSlug,
          });
          if (!id) throw new Error('Não foi possível cadastrar o artista.');
          composerId = id;
          composerName = data.artist;
          composerImage = data.artistImage;
          lyricStyle = data.genre || lyricStyle;
        }
      }

      await updateLyric(lyric.id, {
        ...lyric,
        composerId,
        composerName,
        lyric: data.lyric,
        originalTone: data.tone || lyric.originalTone,
        lyricStyle,
        composerImage,
        coverImage: data.coverImage,
        songwriters: data.songwriters,
        capo: data.capo,
        tuning: data.tuning,
        bpm: data.bpm,
        beatsPerBar: data.beatsPerBar,
        strummings: data.strummings,
        youtubeId: data.youtubeId,
        sourceUrl: data.url,
      });
      // As telas de show carregam a música uma vez; recarrega para mostrar a cifra nova
      // (o repertório volta na mesma música).
      window.location.reload();
    } catch (e: any) {
      setSaveError(e?.message || 'Não foi possível atualizar.');
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth='md' fullScreen={fullScreen}>
      <DialogTitle sx={{ fontFamily: displayFontFamily, fontWeight: 600, pb: 0.5 }}>
        Atualizar cifra
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {loadError ? <Alert severity='error'>{loadError}</Alert> : null}
        {!lyric && !loadError ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>
        ) : null}

        {lyric ? (
          <CifraClubImport
            bare
            autoImportUrl={lyric.sourceUrl}
            initialQuery={lyric.sourceUrl ? undefined : `${lyric.lyricName} ${lyric.composerName}`}
            onImport={handleImport}
          />
        ) : null}

        {lyric && !data && !lyric.sourceUrl ? (
          <Typography variant='body2' sx={{ color: 'text.secondary', mt: 1.5 }}>
            Escolha a música na busca.
          </Typography>
        ) : null}

        {lyric && data ? (
          <Box sx={{ mt: 2.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                mb: 1.5,
              }}
            >
              <Avatar src={data.coverImage || data.artistImage} variant='rounded' sx={{ width: 44, height: 44, borderRadius: '10px' }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>{data.song}</Typography>
                <Typography variant='body2' sx={{ color: 'text.secondary' }} noWrap>
                  {[data.artist, capoLabel(data.capo), data.bpm ? `${data.bpm} bpm` : ''].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {toneAfter ? (
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Você toca em</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                    {toneChanged ? (
                      <Box component='span' sx={{ color: 'text.disabled', textDecoration: 'line-through', fontWeight: 500, mr: 0.75, fontSize: 15 }}>
                        {toneBefore}
                      </Box>
                    ) : null}
                    <Box component='span' sx={{ color: toneChanged ? 'primary.main' : 'text.primary' }}>{toneAfter}</Box>
                  </Typography>
                </Box>
              ) : null}
            </Box>

            {artistDiffers ? (
              <Box sx={{ p: 1.5, pb: 1, mb: 1.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
                  No {sourceName(data.url)} o artista é &quot;{data.artist}&quot;
                </Typography>
                <RadioGroup value={artistMode} onChange={(e) => setArtistMode(e.target.value as ArtistMode)}>
                  {currentComposer ? (
                    <ArtistOption
                      value='update'
                      avatar={<ArtistAvatar image={data.artistImage} name={data.artist} size={26} />}
                      title={<>Atualizar &quot;{lyric.composerName}&quot; com os dados do {sourceName(data.url)}</>}
                      hint={`Vira "${data.artist}", com foto${data.genre ? ` e estilo ${data.genre}` : ''}, em todas as músicas dele`}
                    />
                  ) : null}
                  <ArtistOption
                    value='switch'
                    avatar={<ArtistAvatar composerId={targetComposer?.id} image={data.artistImage} name={data.artist} size={26} />}
                    title={<>Passar a música para &quot;{data.artist}&quot;</>}
                    hint={targetComposer ? 'Artista já cadastrado: os dados dele são atualizados' : 'O artista é cadastrado com foto e estilo'}
                  />
                  <ArtistOption
                    value='keep'
                    avatar={<ArtistAvatar composerId={lyric.composerId} image={lyric.composerImage} name={lyric.composerName} size={26} />}
                    title={<>Manter &quot;{lyric.composerName}&quot; como está</>}
                    hint='Só a cifra é trocada'
                  />
                </RadioGroup>
              </Box>
            ) : null}
            {toneChanged ? (
              <Alert severity='info' sx={{ mb: 1.5 }}>
                O tom original mudou ({lyric.originalTone} → {data.tone}); seu ajuste continua {offset > 0 ? '+' : ''}{offset}.
              </Alert>
            ) : null}

            <Box
              sx={{
                maxHeight: { xs: 'none', sm: '42vh' },
                overflow: 'auto',
                p: 2,
                borderRadius: '12px',
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025),
                ...monoFont,
                fontSize: 13,
                lineHeight: 1.45,
                '& pre': { fontFamily: 'inherit', fontSize: 'inherit', m: 0, whiteSpace: 'pre' },
                '& b': { color: 'chord.main' },
                ...chordSheetMarksSx(theme),
                '& .tablatura': { color: 'text.secondary' },
              }}
            >
              <Markup content={decorateSectionTitles(data.lyric)} />
            </Box>
          </Box>
        ) : null}

        {saveError ? <Alert severity='error' sx={{ mt: 2 }}>{saveError}</Alert> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} color='inherit'>Cancelar</Button>
        <Button
          variant='contained'
          startIcon={<CloudSyncIcon />}
          onClick={confirm}
          disabled={!data}
          loading={saving}
        >
          Atualizar música
        </Button>
      </DialogActions>
    </Dialog>
  );
};
