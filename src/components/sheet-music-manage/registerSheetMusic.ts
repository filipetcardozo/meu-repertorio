import { getAuth } from "firebase/auth";
import { getRegisteredLyric, putSheetMusic, putUserLyricRegistered } from "../../providers/lyrics/services";
import { sheetMusicType } from "../../types/sheetMusicType";

export async function registerSheetMusic(sheetMusicToAdd: sheetMusicType, setLoadingAddSheetMusic: any): Promise<string | false> {
  const auth = getAuth();
  const userId: any = auth.currentUser?.uid;

  delete sheetMusicToAdd.id;

  if (!userId) {
    return false;
  }

  sheetMusicToAdd.userId = userId;

  setLoadingAddSheetMusic(true);

  try {
    const createdSheetMusicId = await putSheetMusic(sheetMusicToAdd);
    if (createdSheetMusicId) {
      const promises = sheetMusicToAdd.lyrics.map(async (lyric: any) => {
        const existingLyric = await getRegisteredLyric(userId, lyric.lyricId);
        if (!existingLyric) {
          lyric.offset = 0;
          lyric.stars = 0;
          lyric.userId = userId;
          await putUserLyricRegistered(lyric);
          console.log("Lyric registered success");
        }
      });

      await Promise.all(promises);

      setLoadingAddSheetMusic(false);
      return createdSheetMusicId;
    }
  } catch (error) {
    console.error(error);
  }

  setLoadingAddSheetMusic(false);
  return false;
}
