import * as React from 'react';
import Grid from '@mui/material/Grid';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/router';

export const CustomHits = ({ hits = [] }: { hits: any[] }) => {
  const router = useRouter();
  if (!hits?.length) return null;

  return (
    <>
      {hits.map((value: any, index: number) => (
        <Grid
          item
          key={value.objectID ?? index}
          sx={{ p: 1 }}
          xs={12}
          sm={6}
          lg={4}
          xl={3}
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
              <Avatar
                sx={(theme) => ({
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === 'dark' ? 0.3 : 0.18
                  ),
                  color: theme.palette.primary.contrastText,
                  fontWeight: 600,
                  width: 32,
                  height: 32,
                  fontSize: 14,
                })}
              >
                {index + 1}
              </Avatar>
            </ListItemAvatar>

            <ListItemText
              primary={value.lyricName}
              secondary={value.composerName}
              primaryTypographyProps={{
                variant: 'subtitle1',
                color: 'text.primary',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
              secondaryTypographyProps={{
                variant: 'body2',
                color: 'text.secondary',
                noWrap: true,
              }}
            />
          </ListItemButton>
        </Grid>
      ))}
    </>
  );
};
