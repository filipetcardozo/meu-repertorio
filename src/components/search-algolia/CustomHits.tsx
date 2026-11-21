import * as React from 'react';
import Grid from '@mui/material/Grid';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/router';
import { ArtistAvatar } from '../ArtistAvatar';

export const CustomHits = ({ hits = [] }: { hits: any[] }) => {
  const router = useRouter();
  if (!hits?.length) return null;

  return (
    <>
      {hits.map((value: any, index: number) => (
        <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}
          key={value.objectID ?? index}
          sx={{ p: 1 }}
        >
          <ListItemButton
            onClick={() => router.push(`/lyric/lyric-show/${value.objectID}`)}
            sx={(theme) => ({
              p: 2,
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
                size={32}
              />
            </ListItemAvatar>

            <ListItemText
              primary={value.lyricName}
              secondary={value.composerName}
              slotProps={{ primary: {
                variant: 'subtitle1',
                color: 'text.primary',
                sx: { fontWeight: 600, lineHeight: 1.2 },
              }, secondary: {
                variant: 'body2',
                color: 'text.secondary',
                noWrap: true,
              } }}
            />
          </ListItemButton>
        </Grid>
      ))}
    </>
  );
};
