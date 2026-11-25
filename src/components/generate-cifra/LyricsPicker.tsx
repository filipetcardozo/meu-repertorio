import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import type { LyricsResult, SyncedLine } from '../../lib/lyricsSearch';
import { monoFont } from '../../theme/createAppTheme';

/** Letra escolhida para gerar a cifra: o texto (editável) e, se veio da internet, as linhas com tempo. */
export type LyricsChoice = {
  lyrics: string;
  synced: SyncedLine[] | null;
  /** 'lrclib' | 'manual' (digitada/colada ou editada) */
  source: string;
  label: string;
};

async function fetchLyrics(song: string, artist: string, duration?: number): Promise<LyricsResult[]> {
  const qs = new URLSearchParams({ song, artist, ...(duration ? { duration: String(Math.round(duration)) } : {}) });
  const r = await fetch(`/api/lyrics/search?${qs.toString()}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || 'Não foi possível buscar a letra.');
  return (body.results ?? []) as LyricsResult[];
}

const labelOf = (r: LyricsResult) => `${r.trackName} · ${r.artistName}${r.synced ? ' (com tempo)' : ''}`;

/**
 * Letra da música para a cifra gerada: busca na internet pelo nome e artista (sozinha, quando
 * `autoSearch`), deixa escolher outro resultado, editar ou colar a letra.
 */
export function LyricsPicker({ song, artist, duration, value, onChange, autoSearch, disabled }: {
  song: string;
  artist: string;
  duration?: number;
  value: LyricsChoice | null;
  onChange: (v: LyricsChoice | null) => void;
  autoSearch?: boolean;
  disabled?: boolean;
}) {
  const [results, setResults] = useState<LyricsResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const searchedFor = useRef<string | null>(null);

  const search = async () => {
    if (song.trim().length < 2) return;
    searchedFor.current = `${song}|${artist}`;
    setLoading(true);
    setError(null);
    try {
      const found = await fetchLyrics(song.trim(), artist.trim(), duration);
      setResults(found);
      if (found[0]) onChange({ lyrics: found[0].lyrics, synced: found[0].synced, source: 'lrclib', label: labelOf(found[0]) });
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoSearch && !value && song.trim().length >= 2 && searchedFor.current !== `${song}|${artist}`) {
      const timer = window.setTimeout(search, 300);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch, song, artist]);

  const pickResult = (i: number) => {
    const r = results?.[i];
    if (r) onChange({ lyrics: r.lyrics, synced: r.synced, source: 'lrclib', label: labelOf(r) });
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, alignItems: { sm: 'center' }, mb: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
          Letra{value ? `: ${value.source === 'lrclib' ? value.label : 'digitada por você'}` : ''}
        </Typography>
        {results && results.length > 1 && value?.source === 'lrclib' && (
          <TextField
            select
            size='small'
            label='Outra versão'
            value={Math.max(0, results.findIndex((r) => labelOf(r) === value.label))}
            onChange={(e) => pickResult(Number(e.target.value))}
            sx={{ minWidth: 220 }}
            disabled={disabled}
          >
            {results.map((r, i) => <MenuItem key={i} value={i}>{labelOf(r)}</MenuItem>)}
          </TextField>
        )}
        <Button
          size='small'
          startIcon={<SearchRoundedIcon />}
          onClick={search}
          loading={loading}
          disabled={disabled || song.trim().length < 2}
        >
          {results ? 'Buscar de novo' : 'Buscar letra'}
        </Button>
        {value && (
          <Button size='small' color='inherit' onClick={() => setEditing((v) => !v)} disabled={disabled}>
            {editing ? 'Fechar edição' : 'Editar'}
          </Button>
        )}
      </Stack>

      {song.trim().length < 2 && !value && (
        <Typography variant='body2' sx={{ color: 'text.secondary', mb: 1 }}>
          Preencha o nome da música (e o artista) para buscar a letra, ou cole a letra abaixo.
        </Typography>
      )}
      {error && <Alert severity='warning' sx={{ mb: 1 }}>{error}</Alert>}
      {results && !results.length && !error && (
        <Alert severity='info' sx={{ mb: 1 }}>
          Não achei a letra na internet. Cole a letra abaixo (estrofes separadas por uma linha em branco) ou deixe
          em branco para usar a letra reconhecida na voz, que costuma ter erros.
        </Alert>
      )}

      {(editing || (!value && results !== null)) ? (
        <TextField
          multiline
          fullWidth
          minRows={8}
          maxRows={18}
          placeholder={'Cole a letra aqui\n\nEstrofes separadas por uma linha em branco'}
          value={value?.lyrics ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const text = e.target.value;
            onChange(text.trim()
              ? { lyrics: text, synced: value?.synced ?? null, source: 'manual', label: 'digitada por você' }
              : null);
          }}
          sx={{ '& textarea': { ...monoFont, fontSize: 13, lineHeight: 1.45 } }}
        />
      ) : value ? (
        <Box
          sx={(theme) => ({
            maxHeight: 160, overflow: 'auto', p: 1.5, borderRadius: '10px', border: `1px solid ${theme.palette.divider}`,
            whiteSpace: 'pre-wrap', fontSize: 13, color: 'text.secondary',
          })}
        >
          {value.lyrics}
        </Box>
      ) : null}
    </Box>
  );
}
