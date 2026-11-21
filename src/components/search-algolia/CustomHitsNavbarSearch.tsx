import * as React from 'react';
import Grid from '@mui/material/Grid';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/router';
import { ArtistAvatar } from '../ArtistAvatar';

type Hit = {
  objectID: string;
  lyricName: string;
  composerName: string;
  composerId?: string;
  composerImage?: string;
};

type Props = {
  hits?: any[];
  closePopper?: () => void;
};

export const CustomHitsNavbarSearch: React.FC<Props> = ({ hits = [], closePopper }) => {
  const router = useRouter();
  if (!hits.length) return null;

  return (
    <>
      {hits.map((value, index) => (
        <Grid size={{ xs: 12, sm: 6 }} key={value.objectID ?? index} sx={{ p: 0.5 }}>
          <ListItemButton
            onClick={() => {
              closePopper?.();
              router.push(`/lyric/lyric-show/${value.objectID}`, undefined, { shallow: true });
            }}
            sx={(theme) => ({
              p: 1.5,
              borderRadius: 2,
              alignItems: 'flex-start',
              backgroundColor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.12 : 0.08
              ),
              border: `1px solid ${alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.24 : 0.16
              )}`,
              transition: theme.transitions.create(
                ['background-color', 'box-shadow', 'transform'],
                { duration: theme.transitions.duration.shortest }
              ),
              '&:hover': {
                backgroundColor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.2 : 0.14
                ),
                boxShadow: theme.shadows[2],
              },
            })}
          >
            <ListItemAvatar>
              <ArtistAvatar
                composerId={value.composerId}
                image={value.composerImage}
                name={value.composerName}
                size={28}
              />
            </ListItemAvatar>

            <ListItemText
              primary={value.lyricName}
              secondary={value.composerName}
              slotProps={{ primary: {
                variant: 'subtitle2',
                color: 'text.primary',
                sx: { fontWeight: 600, lineHeight: 1.2 },
              }, secondary: {
                variant: 'body2',
                color: 'text.secondary',
                noWrap: true,
              } }}
              sx={{ my: 0 }}
            />
          </ListItemButton>
        </Grid>
      ))}
    </>
  );
};
