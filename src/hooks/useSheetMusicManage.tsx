/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react"
import { registerSheetMusic } from "../components/sheet-music-manage/registerSheetMusic"
import { updateSheetMusic } from "../components/sheet-music-manage/updateSheetMusic"
import { deleteSheetMusic, getSheetMusic } from "../providers/lyrics/services"
import { useSnackbar } from "notistack";
import { useRouter } from 'next/router'
import { lyricInSheetMusicType, sheetMusicType } from "../types/sheetMusicType";
import { Timestamp, serverTimestamp } from "firebase/firestore";

export const useSheetMusicManage = ({ sheetMusicId }: { sheetMusicId: any }) => {
  const router = useRouter();

  const [sheetMusicToAdd, setSheetMusicToAdd] = useState<sheetMusicType>({
    id: "",
    sheetMusicName: "",
    description: "",
    userId: "",
    lastUpdated: serverTimestamp() as Timestamp,
    lyrics: []
  })
  const [lyricsToAdd, setLyricsToAdd] = useState<lyricInSheetMusicType[]>([])
  const [loadingAddSheetMusic, setLoadingAddSheetMusic] = useState(false)
  const [oldSheetMusicNameAndDescription, setOldSheetMusicNameAndDescription] = useState({ sheetMusicName: '', description: '' })
  const [loading, setLoading] = useState(true);

  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (sheetMusicId) {
      getSheetMusic(sheetMusicId)
        .then((value) => {
          if (value) {
            sheetMusicToAdd.id = value.id;
            sheetMusicToAdd.description = value.description;
            sheetMusicToAdd.sheetMusicName = value.sheetMusicName;
            sheetMusicToAdd.userId = value.userId;
            sheetMusicToAdd.lyrics = value.lyrics;

            setOldSheetMusicNameAndDescription({ description: value.description, sheetMusicName: value.sheetMusicName });
            setLyricsToAdd(value.lyrics);
            setSheetMusicToAdd({ ...sheetMusicToAdd });
            setLoading(false);
          } else {
            // redirect('/app/sheet-music-create')
            console.log("Invalid id of Sheet Music");
          }
        })
        .catch((error) => {
          console.log("Error in get sheet music of id: " + error);
        })
    }
  }, [])

  const handleDeleteSheetMusic = () => {
    deleteSheetMusic(sheetMusicId)
      .then((value) => {
        router.push('/sheet-music/all-sheet-music');

      })
      .catch((er) => {
        console.log('Error in delete sheet music');
      })
  }

  const handleAddSheetMusic = async () => {
    sheetMusicToAdd.lyrics = lyricsToAdd
    setSheetMusicToAdd({ ...sheetMusicToAdd })

    if (sheetMusicId && sheetMusicId != '') {
      updateSheetMusic(sheetMusicToAdd, setLoadingAddSheetMusic, enqueueSnackbar)
    } else {
      const createdSheetMusicId = await registerSheetMusic(sheetMusicToAdd, setLoadingAddSheetMusic);

      if (createdSheetMusicId) {
        setSheetMusicToAdd({ ...sheetMusicToAdd, id: createdSheetMusicId });
        router.push(`/sheet-music/manage-sheet-music/${createdSheetMusicId}`, undefined, { shallow: true });
        enqueueSnackbar("Repertório adicionado com sucesso!", { variant: "success" });
      }
    }

    setOldSheetMusicNameAndDescription({ description: sheetMusicToAdd.description, sheetMusicName: sheetMusicToAdd.sheetMusicName });
  }

  const handlePushMusicToSheets = (lyricToAdd: any) => {
    // Verify if alredy exists
    let filterLyrics = lyricsToAdd.filter((values) => values.lyricId == lyricToAdd.lyricId).length
    if (filterLyrics > 0) {
      // setOpenAlertAlredyAdd(true)
      return;
    }

    // Adding the new music if not alredy included
    delete lyricToAdd.lyric
    setLyricsToAdd([...lyricsToAdd, lyricToAdd])
  }

  const handleDeleteMusicSheet = (index: number) => {
    lyricsToAdd.splice(index, 1)
    setLyricsToAdd([...lyricsToAdd])
  }

  const someUpdate = useMemo(() => {
    let nameOrDescriptionBeenChanged = oldSheetMusicNameAndDescription.sheetMusicName !== sheetMusicToAdd.sheetMusicName || oldSheetMusicNameAndDescription.description !== sheetMusicToAdd.description;

    if (sheetMusicToAdd.sheetMusicName === '' || lyricsToAdd.length === 0) {
      return false;
    }

    if (lyricsToAdd.length !== sheetMusicToAdd.lyrics.length) {
      return true;
    }

    if (nameOrDescriptionBeenChanged) {
      return true;
    }

    const isDifferentOrder = lyricsToAdd.some((lyric, index) => {
      const sheetMusicLyric = sheetMusicToAdd.lyrics.find(
        (sheetLyric) => sheetLyric.lyricId === lyric.lyricId
      );

      return sheetMusicLyric ? sheetMusicToAdd.lyrics.indexOf(sheetMusicLyric) !== index : true;
    });

    return isDifferentOrder;
  }, [lyricsToAdd, sheetMusicToAdd, sheetMusicId]);

  return {
    sheetMusicToAdd,
    lyricsToAdd,
    loadingAddSheetMusic,
    setSheetMusicToAdd,
    setLyricsToAdd,
    handleDeleteSheetMusic,
    handleAddSheetMusic,
    handlePushMusicToSheets,
    handleDeleteMusicSheet,
    someUpdate,
    loading
  }
}