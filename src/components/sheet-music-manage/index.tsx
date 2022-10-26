import React from 'react';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid'
import List from '@mui/material/List';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import LoadingButton from '@mui/lab/LoadingButton';
import Box from '@mui/material/Box'
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import Tooltip from '@mui/material/Tooltip';
import { FilterLyrics } from './FilterLyrics';
import { ListSheetMusic } from './ListSheetMusic';
import { useSheetMusicManage } from '../../hooks/useSheetMusicManage';

export const ManageSheetMusicComponent = ({ sheetMusicId }: { sheetMusicId: any }) => {
    const {
        lyrics,
        sheetMusicToAdd,
        lyricsToAdd,
        sheetsMusics,
        loadingAddSheetMusic,
        setSheetMusicToAdd,
        setLyricsToAdd,
        handleDeleteSheetMusic,
        handleAddSheetMusic,
        handlePushMusicToSheets,
        handleDeleteMusicSheet
    } = useSheetMusicManage({ sheetMusicId })

    const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
        props,
        ref,
    ) {
        return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
    });

    const AddedLyrics = () => {
        return <>
            <Typography sx={{ mt: 1, mb: 2 }} variant="h6" component="div" textAlign="center" fontWeight="bold">
                Músicas adicionadas
            </Typography>
            {
                lyricsToAdd.length > 0 ? "" : <>
                    <Alert severity="info" sx={{ backgroundColor: "#d0eeff", color: "#3d3d3d", boxShadow: 0 }}>
                        Ainda não foi adicionada nenhuma música — <strong>as músicas adicionadas aparecerão aqui!</strong>
                    </Alert>
                    <Alert severity="info" sx={{ mt: 2, backgroundColor: "#d0eeff", color: "#3d3d3d", boxShadow: 0 }}>
                        <strong>Você pode reordenar as músicas arrastando e soltando!</strong>
                    </Alert>
                </>
            }

            <Box>
                <List dense={true}>
                    {<ListSheetMusic lyrics={lyricsToAdd} setLyrics={setLyricsToAdd} handleDeleteMusicSheet={handleDeleteMusicSheet} />}
                </List>
            </Box>
        </>
    }

    return (
        <>
            <Box px={3} py={2} sx={{ mt: 2, backgroundColor: "#a1bbd412", borderRadius: 1.4, boxShadow: 1, position: "relative" }}>
                <Grid container spacing={5}>
                    <Grid item xs={4}>
                        <TextField label="Nome da partitura" size="small" id="filled-basic" variant="filled" name="sheetMusicName" fullWidth
                            value={sheetMusicToAdd.sheetMusicName}
                            onChange={(event) => setSheetMusicToAdd({ ...sheetMusicToAdd, sheetMusicName: event.target.value })}
                        />
                    </Grid>
                    <Grid item xs={8}>
                        <TextField label="Descrição" size="small" multiline id="filled-basic" variant="filled" name="description" fullWidth
                            value={sheetMusicToAdd.description}
                            onChange={(event) => setSheetMusicToAdd({ ...sheetMusicToAdd, description: event.target.value })}
                        />
                    </Grid>
                    {/* Musicas Adicionadas */}
                    <Grid item xs={4}>
                        {<AddedLyrics />}
                    </Grid>
                    {/* {<FilterLyrics />} */}
                    <Grid item xs={8} minHeight={400}>
                        {<FilterLyrics sheetsMusics={sheetsMusics}
                            lyrics={lyrics} handlePushMusicToSheets={handlePushMusicToSheets}
                            lyricsToAdd={lyricsToAdd} />}
                    </Grid>
                    <Grid item xs={12} textAlign="center" position="relative">
                        <LoadingButton variant="outlined" onClick={handleAddSheetMusic} loading={loadingAddSheetMusic}>
                            {sheetMusicId ? "Atualizar repertório" : "Adicionar repertório"}
                        </LoadingButton>
                        {/* Start sheet music */}
                        {
                            sheetMusicId ?
                                <IconButton sx={{ position: "absolute", right: 0 }}
                                    onClick={() => {
                                        // redirect(`/app/sheet-music/${params.sheetMusicId}`)
                                    }}
                                >
                                    <Tooltip title="Iniciar Show" placement="top">
                                        <PlayCircleFilledIcon style={{ color: "#a7d7ff" }} />
                                    </Tooltip>
                                </IconButton> : <></>
                        }
                        {
                            sheetMusicId ?
                                <IconButton sx={{ position: "absolute", right: 35 }}
                                    onClick={() => handleDeleteSheetMusic()}>
                                    <Tooltip title="Excluir partitura" placement="top">
                                        <DeleteIcon style={{ color: "#ffb7b7" }} />
                                    </Tooltip>
                                </IconButton> : <></>
                        }
                    </Grid>
                </Grid>
            </Box>
        </>
    )
}