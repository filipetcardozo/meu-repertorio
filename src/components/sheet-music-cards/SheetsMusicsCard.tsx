
import React from "react";
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid'
import LyricsIcon from '@mui/icons-material/Lyrics';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import Chip from '@mui/material/Chip';
import PersonIcon from '@mui/icons-material/Person';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CardHeader from '@mui/material/CardHeader';
import Avatar from '@mui/material/Avatar';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FiEdit } from 'react-icons/fi';
import Link from "next/link";
import { useRouter } from "next/router";
import { sheetMusicType } from "../../types/sheetMusicType";
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { useStorageSheetMusic } from "../../hooks/useStorageSheetMusic";
import { useSnackbar } from "notistack";

export const SheetsMusicsCard = ({ sheetMusic, setSheetsMusics, sheetsMusics, index }: { sheetMusic: sheetMusicType, setSheetsMusics: any, sheetsMusics: any, index: any }) => {
  const router = useRouter()
  const { enqueueSnackbar } = useSnackbar();
  const { callDeleteCompletedSheetMusicLocalStorage } = useStorageSheetMusic()

  function cleanCompleted() {
    callDeleteCompletedSheetMusicLocalStorage(sheetMusic.id!)
    sheetsMusics[index].completed = undefined
    setSheetsMusics([...sheetsMusics])
    enqueueSnackbar("O histórico da partitura foi limpado!", { variant: "success" })
  }

  if (!sheetMusic) return <></>;

  return <Card sx={{ boxShadow: 3, width: "300px" }}>
    <CardHeader
      avatar={
        <Avatar sx={{ bgcolor: "primary.light", width: 30, height: 30, fontSize: 17 }} aria-label="recipe">
          {index + 1}
        </Avatar>
      }
      action={
        <IconButton
          onClick={() => {
            router.push(`/sheet-music/manage-sheet-music/${sheetMusic.id}`)
          }}
          size="small"
        >
          <FiEdit style={{ fontSize: 13 }} />
        </IconButton>
      }
      title={sheetMusic.sheetMusicName}
    />
    <CardContent>
      <Typography sx={{ fontSize: 13 }} color="text.secondary">
        {sheetMusic.description}
      </Typography>
      <Typography sx={{ my: 2, display: "flex", alignItems: "center", gap: 1 }} variant="body2" color="text.secondary">
        <LyricsIcon sx={{ color: "#6ab5ff" }} /> <strong>{sheetMusic.lyrics.length} </strong> músicas adicionadas
      </Typography>
      <Typography sx={{ my: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }} variant="body2" color="text.secondary">
        <AccessTimeIcon sx={{ color: "#6ab5ff" }} /> Aproximadamente <strong>{sheetMusic.lyrics.length * 4} minutos</strong>
      </Typography>
    </CardContent>

    <CardActions sx={{ justifyContent: "space-between" }}>
      <Link style={{ textDecoration: "none" }} href={`/sheet-music/show-sheet-music/${sheetMusic.id}`} >
        <Button sx={{ fontWeight: "bold" }} size="small" startIcon={<PlayCircleOutlineIcon sx={{ position: "relative", bottom: 1.3, left: 3 }} />}>Iniciar Show</Button>
      </Link>
      {
        sheetMusic.completed ?
          <Tooltip
            title="Aqui está sendo informado a quantidade de músicas já tocadas. Se você deseja resetar essa informação clique em cima do número."
          >
            <Button variant="text" onClick={() => cleanCompleted()}>
              <Box sx={{ display: "flex", alignItems: "center", mr: 1, gap: 0.5 }}>
                <Typography sx={{ fontSize: 16 }} color="primary" >
                  {sheetMusic.completed + "/" + sheetMusic.lyrics.length}
                </Typography>
                <InfoIcon color="primary" sx={{ fontSize: 16, pb: 0.2 }} />
              </Box>
            </Button>
          </Tooltip> : <></>
      }

    </CardActions>
  </Card >
}