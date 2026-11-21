import React, { useEffect, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { alpha, SxProps, Theme } from '@mui/material/styles';
import { getAllComposers } from '../providers/lyrics/services';
import type { composerType } from '../types/composerType';

/**
 * Fotos dos artistas por id. Carrega a coleção de artistas uma vez por sessão e compartilha
 * entre todos os avatares (as músicas antigas não têm a foto copiada, só o composerId).
 */
let composersPromise: Promise<Map<string, string>> | null = null;
let composersCache: Map<string, string> | null = null;

function loadComposerImages() {
  if (!composersPromise) {
    composersPromise = getAllComposers()
      .then((list: composerType[]) => {
        composersCache = new Map(list.filter((c) => c.id && c.image).map((c) => [c.id!, c.image!]));
        return composersCache;
      })
      .catch(() => {
        composersPromise = null; // tenta de novo na próxima vez
        return new Map<string, string>();
      });
  }
  return composersPromise;
}

export function useComposerImage(composerId?: string, image?: string): string | undefined {
  const [fromCache, setFromCache] = useState<string | undefined>(() =>
    composerId ? composersCache?.get(composerId) : undefined,
  );
  useEffect(() => {
    if (image || !composerId) return;
    let alive = true;
    loadComposerImages().then((map) => {
      if (alive) setFromCache(map.get(composerId));
    });
    return () => {
      alive = false;
    };
  }, [composerId, image]);
  return image || fromCache;
}

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

type Props = {
  composerId?: string;
  /** Foto já conhecida (ex.: composerImage salvo na música) */
  image?: string;
  name?: string;
  size?: number;
  /** Selo no canto (número da música no repertório, check de tocada…) */
  badge?: React.ReactNode;
  /** Anel na cor da marca (música atual) */
  active?: boolean;
  /** Esmaecida (música já tocada) */
  dimmed?: boolean;
  sx?: SxProps<Theme>;
};

/** Foto do artista com fallback nas iniciais. */
export const ArtistAvatar = ({ composerId, image, name, size = 32, badge, active, dimmed, sx }: Props) => {
  const src = useComposerImage(composerId, image);
  const badgeSize = Math.max(14, Math.round(size * 0.48));

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Avatar
        src={src}
        alt={name}
        sx={[
          (theme) => ({
            width: size,
            height: size,
            fontSize: Math.round(size * 0.38),
            fontWeight: 600,
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14),
            color: theme.palette.primary.main,
            opacity: dimmed ? 0.55 : 1,
            transition: theme.transitions.create(['opacity', 'box-shadow']),
            boxShadow: active
              ? `0 0 0 2px ${theme.palette.background.default}, 0 0 0 4px ${theme.palette.primary.main}`
              : 'none',
          }),
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {initials(name)}
      </Avatar>
      {badge !== undefined && badge !== null ? (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            right: -Math.round(badgeSize * 0.3),
            bottom: -Math.round(badgeSize * 0.3),
            minWidth: badgeSize,
            height: badgeSize,
            px: 0.25,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            fontSize: Math.round(badgeSize * 0.62),
            fontWeight: 700,
            lineHeight: 1,
            color: active ? theme.palette.primary.contrastText : theme.palette.text.primary,
            backgroundColor: active ? theme.palette.primary.main : theme.palette.background.paper,
            border: `1.5px solid ${theme.palette.background.default}`,
            boxShadow: theme.shadows[1],
          })}
        >
          {badge}
        </Box>
      ) : null}
    </Box>
  );
};

/** Selo de "já tocada". */
export const PlayedBadge = () => <CheckRoundedIcon sx={{ fontSize: 'inherit', color: 'primary.main' }} />;
