import * as React from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';

type Props = {
  drawerWidth?: number;
  appBarHeight?: number;
};

export const AppBootSkeleton: React.FC<Props> = ({
  drawerWidth = 240,
  appBarHeight = 64,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <Box
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          borderRight: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            height: appBarHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
          }}
        >
          <Skeleton variant="rounded" width={140} height={28} />
          <Skeleton variant="circular" width={32} height={32} />
        </Box>

        <Box sx={{ px: 1.5 }}>
          {[...Array(7)].map((_, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 1,
                px: 1,
                py: 1,
              }}
            >
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton
                variant="rounded"
                width={drawerWidth - 28 - 1.5 * 8 - 2 * 8}
                height={24}
              />
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            height: appBarHeight,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Skeleton variant="circular" width={36} height={36} />

          <Skeleton variant="rounded" width={320} height={36} />

          <Skeleton variant="rounded" width={90} height={28} />

          <Box sx={{ flex: 1 }} />

          <Skeleton variant="rounded" width={130} height={36} />
          <Skeleton variant="circular" width={36} height={36} />
        </Box>

        <Box sx={{ p: 2 }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 2 }} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};
