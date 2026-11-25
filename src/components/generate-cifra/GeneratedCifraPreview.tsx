import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import { alpha, type Theme } from '@mui/material/styles';
import { Markup } from 'interweave';
import type { PlaybackGenerated } from '../../types/playbackType';
import { decorateSectionTitles } from '../../utils/sectionTitles';
import { chordSheetMarksSx } from '../lyric-show/chordSheetStyles';
import { monoFont } from '../../theme/createAppTheme';

export const generatedSheetSx = (theme: Theme) => ({
  maxHeight: { xs: 'none', md: '52vh' },
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
});

/** Cifra gerada pela plataforma: tom, andamento, aviso de rascunho e a cifra como vai aparecer. */
export function GeneratedCifraPreview({ generated }: { generated: PlaybackGenerated }) {
  return (
    <>
      <Stack direction='row' sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1.25 }}>
        {generated.tone ? <Chip size='small' color='primary' variant='outlined' label={`Tom ${generated.tone}`} /> : null}
        {generated.bpm ? <Chip size='small' variant='outlined' label={`${generated.bpm} bpm`} /> : null}
        <Chip
          size='small'
          variant='outlined'
          label={generated.lines ? `${generated.lines} linhas de letra` : 'Só acordes (sem voz)'}
        />
      </Stack>
      <Alert severity='info' sx={{ mb: 1.5 }}>
        É um rascunho feito ouvindo o áudio: confira os acordes (as tríades costumam sair certas; sétimas,
        acordes com 9, 11 e baixos invertidos, nem sempre) e a letra antes de usar no show.
      </Alert>
      <Box sx={generatedSheetSx}>
        <Markup content={decorateSectionTitles(generated.lyric ?? '')} />
      </Box>
    </>
  );
}
