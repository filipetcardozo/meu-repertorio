import React, { useMemo } from 'react';
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
import Link from 'next/link';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { CircularProgress, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UpdateIcon from '@mui/icons-material/Update';

export const ManageSheetMusicComponent = ({ sheetMusicId }: { sheetMusicId: any }) => {
  const {
    sheetMusicToAdd,
    lyricsToAdd,
    loadingAddSheetMusic,
    loading,
    someUpdate,
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

  const [openModalDelete, setOpenModalDelete] = React.useState(false);

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <CircularProgress />
    </Box>
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
            {<FilterLyrics
              handlePushMusicToSheets={handlePushMusicToSheets}
              lyricsToAdd={lyricsToAdd} />}
          </Grid>
        </Grid>

        <Box
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Fab
            color="primary"
            aria-label={sheetMusicId ? "Atualizar repertório" : "Adicionar repertório"}
            variant='extended'
            size='small'

            onClick={handleAddSheetMusic}
            disabled={loadingAddSheetMusic || !someUpdate}
          >
            <Box sx={{ mr: 1, position: 'relative', top: 4 }}>{sheetMusicId ? <UpdateIcon /> : <AddIcon />}</Box>
            {sheetMusicId ? "Atualizar repertório" : "Adicionar repertório"}
          </Fab>
          {
            sheetMusicId ?
              <>
                <Link href={`/sheet-music/show-sheet-music/${sheetMusicId}`}>
                  <IconButton sx={{ ml: 3 }}>
                    <Tooltip title="Iniciar Show" placement="top">
                      <PlayCircleFilledIcon color='success' />
                    </Tooltip>
                  </IconButton>
                </Link>
                <IconButton onClick={() => setOpenModalDelete(true)}>
                  <Tooltip title="Excluir repertório" placement="top">
                    <DeleteIcon color='error' />
                  </Tooltip>
                </IconButton>
              </>
              : <></>
          }
        </Box>

        <Dialog
          open={openModalDelete}
          onClose={() => setOpenModalDelete(false)}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            Confirmação
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Tem certeza que deseja excluir este repertório?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModalDelete(false)}>Cancelar</Button>
            <Button onClick={() => {
              handleDeleteSheetMusic();
              setOpenModalDelete(false);
            }}>
              Excluir repertório
            </Button>
          </DialogActions>
        </Dialog>
      </Box >
    </>
  )
}