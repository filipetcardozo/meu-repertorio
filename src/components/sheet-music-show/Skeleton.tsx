import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import { Skeleton } from '@mui/material';

export const SkeletonComponent = () => {
    return <Stack direction="row" sx={{ mt: 1 }}>
        <Box sx={{ ml: 2, mt: 2, maxWidth: 200 }}>
            {renderSkeletonStepper()}
        </Box>
        <Box sx={{ ml: 8, mt: 4, maxWidth: 400 }}>
            {renderSkeletonLyric()}
        </Box>
        <Box sx={{ ml: 8, mt: 4, maxWidth: 400 }}>
            {renderSkeletonLyric(false)}
        </Box>
        <Box sx={{ ml: 8, mt: 4, maxWidth: 400 }}>
            {renderSkeletonLyric(false)}
        </Box>
    </Stack>
}

function renderSkeletonStepper() {
    let skeletonArray = []

    for (let i = 0; i <= 7; i++) {
        skeletonArray.push(
            <Grid container>
                <Grid item xs={1}>
                    <Skeleton variant="circular" width={25} height={25} />
                </Grid>
                <Grid item xs={8}>
                    <Skeleton sx={{ ml: 3 }} variant="text" height={15} width={i % 2 == 0 ? 110 : 80} />
                    <Skeleton sx={{ ml: 3 }} variant="text" height={10} width={i % 2 == 0 ? 80 : 50} />
                </Grid>
            </Grid>
        )
    }

    return (
        <Stack spacing={4}>
            {skeletonArray}
        </Stack>
    )
}

function renderSkeletonLyric(withHeader = true) {
    let skeletonArray = []

    // Header lyric
    if (withHeader) {
        skeletonArray.push(
            <Stack direction="column">
                {/* Lyrics Notes */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Skeleton variant="text" sx={{ ml: 1 }} height={30} width={130} />
                    <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={50} />
                    <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={20} />
                </Stack>
            </Stack>
        )
    }

    for (let i = 0; i <= 2; i++) {
        skeletonArray.push(
            <Stack direction="column">
                {/* Lyrics Notes */}
                <Stack direction="row" spacing={5} justifyContent={i % 2 == 0 ? "start" : "space-around"}>
                    <Skeleton variant="text" sx={{ ml: 3 }} height={23} width={30} />
                    <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={30} />
                </Stack>
                <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={i % 2 == 0 ? 170 : 140} />

                <Stack direction="row" spacing={5} justifyContent="center">
                    <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={30} />
                </Stack>
                <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={i % 2 == 1 ? 200 : 110} />
                <Stack direction="row" spacing={5}
                    justifyContent={i % 2 == 0 ? "start" : "end"}
                >
                    <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={30} />
                    <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={30} />
                    {i % 2 == 0 ? <></> :
                        <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={30} />
                    }
                </Stack>
                <Skeleton variant="text" sx={{ ml: 1 }} height={23} width={i % 2 == 0 ? 220 : 80} />
            </Stack >
        )
    }

    return (
        <Stack spacing={4}>
            {skeletonArray}
        </Stack>
    )
}