import React, { useEffect } from 'react';
import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid'
import List from '@mui/material/List';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import LoadingButton from '@mui/lab/LoadingButton';
import { getAuth } from "firebase/auth";
import Box from '@mui/material/Box'
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import Tooltip from '@mui/material/Tooltip';
import { FilterLyrics } from './FilterLyrics';
import { deleteSheetMusic, getAllSheetsMusics, getSheetMusic } from '../../providers/lyrics/service';
import { ListSheetMusic } from './ListSheetMusic';
import { updateSheetMusic } from './updateSheetMusic';
import { registerSheetMusic } from './registerSheetMusic';
import { Router } from 'next/router';

const auth = getAuth();
const userId: any = auth.currentUser?.uid

export const ManageSheetMusicComponent = ({ sheetMusicId }: { sheetMusicId: any }) => {
    // let params = useParams<{ sheetMusicId?: string }>()
    // let redirect = useNavigate()

    const [lyrics, setLyrics] = useState<any>([])

    useEffect(() => {
        console.log(lyrics)
    }, [lyrics])

    // All Musics
    const [sheetMusicToAdd, setSheetMusicToAdd] = useState<any>({
        id: "",
        sheetMusicName: "",
        description: "",
        userId: "",
        lyrics: [{
            composerName: "",
            composerId: "",
            originalTone: "",
            lyricStyle: "",
            lyricName: "",
            lyricId: ""
        }]
    })
    // Used in save
    const [lyricsToAdd, setLyricsToAdd] = useState<any[]>([])

    useEffect(() => {
        if (sheetMusicId) {
            getSheetMusic(sheetMusicId)
                .then((value) => {
                    if (value) {
                        console.log("Sheet Music for change:")
                        console.log(value)
                        sheetMusicToAdd.id = value.id
                        sheetMusicToAdd.description = value.description
                        sheetMusicToAdd.sheetMusicName = value.sheetMusicName
                        sheetMusicToAdd.userId = value.userId
                        sheetMusicToAdd.lyrics = value.lyrics

                        setLyricsToAdd(value.lyrics)

                        setSheetMusicToAdd({ ...sheetMusicToAdd })
                    } else {
                        setOpenAlertVoidId(true)
                        // redirect('/app/sheet-music-create')
                        console.log("Invalid id of Sheet Music")
                    }
                })
                .catch((error) => {
                    console.log("Error in get sheet music of id: " + error)
                })
        }
    }, [])

    const [sheetsMusics, setSheetsMusics] = React.useState<any[]>([])
    const [filteredValue, setFilteredValue] = useState("Todas as músicas")
    // Get sheets musics registereds
    useEffect(() => {
        getAllSheetsMusics(userId)
            .then((sheets: any) => {
                setSheetsMusics(sheets)
            })
    }, [])

    useEffect(() => {
        if (filteredValue.startsWith("Partitura:")) {
            let newFiltered = sheetsMusics.filter((el) => el.sheetMusicName == filteredValue.replace("Partitura: ", ""))

            if (newFiltered.length > 0) setLyrics(newFiltered[0].lyrics);
        }

        if (filteredValue.startsWith("Gênero:")) {
            console.log("GENNNERO")
        }

    }, [filteredValue])

    // Alert modal alredy exist
    const [openAlertAlredyAdd, setOpenAlertAlredyAdd] = React.useState(false);
    const [openAlertAddSheetMusic, setOpenAlertAddSheetMusic] = React.useState(false);
    const [openAlertUpdateSheetMusic, setOpenAlertUpdateSheetMusic] = React.useState(false);
    const [openAlertEmptyMusics, setOpenAlertEmptyMusics] = React.useState(false);
    const [openAlertVoidId, setOpenAlertVoidId] = React.useState(false);
    const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenAlertAlredyAdd(false);
        setOpenAlertAddSheetMusic(false);
        setOpenAlertUpdateSheetMusic(false);
        setOpenAlertEmptyMusics(false);
        setOpenAlertVoidId(false);
    };

    const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
        props,
        ref,
    ) {
        return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
    });
    const handlePushMusicToSheets = (lyricToAdd: any) => {
        // Verify if alredy exists
        let filterLyrics = lyricsToAdd.filter((values) => values.lyricId == lyricToAdd.lyricId).length
        if (filterLyrics > 0) {
            setOpenAlertAlredyAdd(true)
            return;
        }

        // Adding the new music if not alredy included
        delete lyricToAdd.lyric
        setLyricsToAdd([...lyricsToAdd, lyricToAdd])
    }

    const handleDeleteMusicSheet = (index: number) => {
        // Excluindo a musica
        lyricsToAdd.splice(index, 1)
        setLyricsToAdd([...lyricsToAdd])
    }

    const [loadingAddSheetMusic, setLoadingAddSheetMusic] = useState(false)
    const addSheetMusic = async () => {
        sheetMusicToAdd.lyrics = lyricsToAdd
        setSheetMusicToAdd({ ...sheetMusicToAdd })

        // debugger
        if (sheetMusicId != "") {
            console.log("Updated")
            updateSheetMusic(sheetMusicToAdd, setLoadingAddSheetMusic, setOpenAlertUpdateSheetMusic)
        } else {
            console.log(userId)
            console.log(sheetMusicToAdd)
            registerSheetMusic(sheetMusicToAdd, setLoadingAddSheetMusic, setOpenAlertAddSheetMusic)
        }
    }

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

    const handleDeleteSheetMusic = () => {
        deleteSheetMusic(sheetMusicId)
            .then((value) => {
                console.log('heree')
            })
            .catch((er) => {
                console.log('Error in delete sheet music')
            })
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
                        {<FilterLyrics sheetsMusics={sheetsMusics} setFilteredValue={setFilteredValue}
                            filteredValue={filteredValue} lyrics={lyrics} handlePushMusicToSheets={handlePushMusicToSheets}
                            lyricsToAdd={lyricsToAdd} />}
                        {/* Pagination */}
                        {/* <Grid item xs={12}>
                            <Button variant="text" color="primary" sx={{ textTransform: "none" }}
                                onClick={() => handleGetLyrics()}
                            >
                                Mostrar mais...
                            </Button>
                        </Grid> */}
                    </Grid>
                    <Grid item xs={12} textAlign="center" position="relative">
                        <LoadingButton variant="outlined" onClick={addSheetMusic} loading={loadingAddSheetMusic}>
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



            <Snackbar open={openAlertAlredyAdd} autoHideDuration={3000} onClose={handleClose}>
                <Alert onClose={handleClose} severity="warning" sx={{ width: '100%' }}>
                    Essa música já foi adicionada ao repertório.
                </Alert>
            </Snackbar>

            <Snackbar open={openAlertAddSheetMusic} autoHideDuration={3000} onClose={handleClose}>
                <Alert onClose={handleClose} severity="success" sx={{ width: '100%' }}>
                    Repertório adicionado com sucesso!
                </Alert>
            </Snackbar>

            <Snackbar open={openAlertUpdateSheetMusic} autoHideDuration={3000} onClose={handleClose}>
                <Alert onClose={handleClose} severity="success" sx={{ width: '100%' }}>
                    Repertório atualizado com sucesso!
                </Alert>
            </Snackbar>

            <Snackbar open={openAlertEmptyMusics} autoHideDuration={3000} onClose={handleClose}>
                <Alert onClose={handleClose} severity="info" sx={{ width: '100%' }}>
                    Ops... não existem mais músicas com esse filtro.
                </Alert>
            </Snackbar>

            <Snackbar open={openAlertVoidId} autoHideDuration={3000} onClose={handleClose}>
                <Alert onClose={handleClose} severity="warning" sx={{ width: '100%' }}>
                    Ops... nenhuma partitura encontrada. &#128533;
                </Alert>
            </Snackbar>
        </>
    )
}