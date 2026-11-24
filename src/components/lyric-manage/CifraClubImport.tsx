import React, { useEffect, useRef, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import VerifiedIcon from '@mui/icons-material/Verified';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { alpha } from '@mui/material/styles';
import type { CifraImport, CifraSearchResult, CifraVersion } from '../../lib/cifraClub';
import { cifraExtensionInstallUrl, importWithCifraExtension } from '../../lib/cifraClubExtension';
import { displayFontFamily } from '../../theme/createAppTheme';
import { BrandIcon } from './formUi';

export type CifraImportInfo = {
  /** true quando só trocou a versão de uma música já importada */
  versionSwitch: boolean;
};

type Props = {
  onImport: (data: CifraImport, info: CifraImportInfo) => void;
  /** Texto já digitado na busca ao abrir (ex.: "Música Artista") — mostra os resultados de cara */
  initialQuery?: string;
  /** Link para importar assim que abrir (ex.: o `sourceUrl` salvo na música) */
  autoImportUrl?: string;
  /** Sem o card e o título (para usar dentro de um diálogo) */
  bare?: boolean;
};

type ImportError = {
  message: string;
  retry?: { url: string; versionSwitch: boolean };
  extensionNeeded?: boolean;
};

const isCifraUrl = (s: string) => /^https?:\/\/(www\.|m\.)?cifraclub\.com\.br\//i.test(s.trim());
const formatLists = (n?: number) =>
  n === undefined ? '' : n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil listas` : `${n} listas`;

export const CifraClubImport = ({ onImport, initialQuery, autoImportUrl, bare }: Props) => {
  const [input, setInput] = useState(initialQuery ?? '');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CifraSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<ImportError | null>(null);
  const [current, setCurrent] = useState<CifraImport | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const openOnResults = useRef(!!initialQuery && !autoImportUrl);

  const query = input.trim();
  const canSearch = query.length >= 2 && !isCifraUrl(query);

  // Busca com debounce enquanto digita (ignora quando é um link colado).
  useEffect(() => {
    if (!canSearch) {
      abortRef.current?.abort();
      return;
    }
    const q = query;
    const timer = setTimeout(async () => {
      setSearching(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/cifra/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erro na busca.');
        setOptions(data.results ?? []);
        setError(null);
        if (openOnResults.current) {
          openOnResults.current = false;
          setOpen(true);
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setOptions([]);
        setError({ message: e?.message || 'Erro na busca.' });
      } finally {
        if (abortRef.current === controller) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, canSearch]);

  const importUrl = async (url: string, versionSwitch = false) => {
    abortRef.current?.abort();
    setImporting(url);
    setError(null);
    setOpen(false);
    let extensionNeeded = false;
    let extensionError: unknown;
    try {
      let data = await importWithCifraExtension(url).catch((e: unknown) => {
        extensionError = e;
        return undefined;
      });
      if (!data) {
        const res = await fetch(`/api/cifra/import?url=${encodeURIComponent(url)}`);
        const body = await res.json();
        if (!res.ok) {
          if (body?.code === 'CIFRA_ACCESS_DENIED') {
            if (extensionError instanceof Error) throw extensionError;
            extensionNeeded = true;
          }
          throw new Error(body?.error || 'Não foi possível importar.');
        }
        data = body as CifraImport;
      }
      setCurrent(data);
      onImport(data, { versionSwitch });
      setInput('');
      setOptions([]);
    } catch (e: any) {
      setError({
        message: e?.message || 'Não foi possível importar.',
        retry: { url, versionSwitch },
        extensionNeeded,
      });
    } finally {
      setImporting(null);
    }
  };

  // Música que já veio do Cifra Club: busca a mesma página de novo.
  const autoImported = useRef(false);
  useEffect(() => {
    if (autoImportUrl && !autoImported.current) {
      autoImported.current = true;
      importUrl(autoImportUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoImportUrl]);

  const pastedUrl = isCifraUrl(input);

  // Versões: as que a página destaca + a importada (se for outra, ex.: ukulele ou de usuário)
  const versions: CifraVersion[] = current?.versions ? [...current.versions] : [];
  if (current && !versions.some((v) => v.url === current.url)) {
    versions.push({ label: current.versionLabel || 'Versão importada', url: current.url });
  }

  const search = (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
      <Autocomplete<CifraSearchResult, false, false, true>
        freeSolo
        fullWidth
        open={open && canSearch && (options.length > 0 || searching)}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={canSearch ? options : []}
        filterOptions={(x) => x}
        loading={canSearch && searching}
        disabled={!!importing}
        inputValue={input}
        onInputChange={(_, v, reason) => {
          if (reason !== 'reset') setInput(v);
        }}
        value={null}
        onChange={(_, v) => {
          if (v && typeof v !== 'string') importUrl(v.url);
          else if (typeof v === 'string' && isCifraUrl(v)) importUrl(v);
        }}
        getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.song} - ${o.artist}`)}
        isOptionEqualToValue={(a, b) => typeof b !== 'string' && a.url === b.url}
        noOptionsText='Nenhuma música encontrada.'
        loadingText='Buscando…'
        renderOption={(props, o) => {
          const { key, ...rest } = props as any;
          return (
            <li key={o.url} {...rest}>
              <Avatar src={o.image} variant='rounded' sx={{ width: 32, height: 32, mr: 1.5 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant='body2' noWrap>{o.song}</Typography>
                <Typography variant='caption' color='text.secondary' noWrap>{o.artist}</Typography>
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            variant='outlined'
            placeholder='Ex.: Tempo Perdido, Legião Urbana… ou cole o link'
            sx={(theme) => ({
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                minHeight: 52,
                pl: 2,
                backgroundColor: theme.palette.background.paper,
                transition: theme.transitions.create(['box-shadow']),
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.45) },
                '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}` },
                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: 1 },
              },
              '& .MuiOutlinedInput-input': { fontSize: 15 },
            })}
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                startAdornment: (
                  <InputAdornment position='start' sx={{ color: 'text.secondary', mr: 0.5 }}>
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <>
                    {(canSearch && searching) || importing ? <CircularProgress color='inherit' size={18} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {pastedUrl && (
        <Button
          variant='contained'
          startIcon={<CloudDownloadIcon />}
          onClick={() => importUrl(input.trim(), !!current)}
          loading={!!importing}
          sx={{ flexShrink: 0, height: 52, px: 3 }}
        >
          Importar
        </Button>
      )}
    </Box>
  );

  const versionBar = current && (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', mr: 0.5 }}>Versão</Typography>
        {versions.map((v) => {
          const active = v.url === current.url;
          return (
            <Chip
              key={v.url}
              label={
                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {v.label}
                  {v.verified ? <VerifiedIcon sx={{ fontSize: 14 }} /> : null}
                  {v.lists !== undefined ? (
                    <Box component='span' sx={{ opacity: 0.7, fontWeight: 400 }}>· {formatLists(v.lists)}</Box>
                  ) : null}
                </Box>
              }
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              onClick={active || importing ? undefined : () => importUrl(v.url, true)}
              icon={importing === v.url ? <CircularProgress size={14} color='inherit' /> : undefined}
              sx={{ fontWeight: 600 }}
            />
          );
        })}
        <Tooltip title='Abra no Cifra Club, copie o link da versão e cole na busca'>
          <Link
            href={versions[0]?.url ?? current.url}
            target='_blank'
            rel='noreferrer'
            sx={{ fontSize: 13, ml: 0.5, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
          >
            Outras versões <OpenInNewIcon sx={{ fontSize: 13 }} />
          </Link>
        </Tooltip>
      </Box>
    </Box>
  );

  const errorAlert = error && (
    <Alert severity='error' sx={{ mt: 1.5 }} onClose={() => setError(null)}>
      {error.message}
      {error.extensionNeeded && (
        <Typography variant='body2' sx={{ mt: 0.5 }}>
          Instale a extensão Meu Repertório no Chrome para computador e tente novamente.
        </Typography>
      )}
      {error.retry && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {error.extensionNeeded && cifraExtensionInstallUrl && (
            <Button size='small' href={cifraExtensionInstallUrl} target='_blank' rel='noopener noreferrer'>
              Instalar extensão
            </Button>
          )}
          <Button size='small' onClick={() => error.retry && importUrl(error.retry.url, error.retry.versionSwitch)}>
            Tentar novamente
          </Button>
        </Box>
      )}
    </Alert>
  );

  if (bare) {
    return (
      <Box>
        {search}
        {errorAlert}
        {versionBar}
      </Box>
    );
  }

  return (
    <Paper
      variant='outlined'
      sx={(theme) => ({
        p: { xs: 2, sm: 3 },
        mb: 3,
        borderRadius: 4,
        borderColor: alpha(theme.palette.primary.main, 0.25),
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, transparent 60%)`,
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <BrandIcon>
          <CloudDownloadIcon />
        </BrandIcon>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 17, lineHeight: 1.3 }}>
            Importar do Cifra Club
          </Typography>
          <Typography variant='body2' sx={{ color: 'text.secondary' }}>
            Busque pela música ou artista, ou cole o link. Cifra, tom, ritmo e artista são preenchidos sozinhos.
          </Typography>
        </Box>
      </Box>
      {search}
      {errorAlert}
      {versionBar}
    </Paper>
  );
};
