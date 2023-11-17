/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'

const scaleNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export const useLyricShow = ({
  lyricToShow,
  offsetLyricToShow,
  nextLyricToShow
}: any) => {
  const [habiliteSolo, setHabiliteSolo] = useState(true)
  const [lengthSecondColumn, setLengthSecondColumn] = useState(0)

  const [htmlLyric, setHtmlLyric] = useState<any>()
  const [htmlLyricSecond, setHtmlLyricSecond] = useState<any>()
  const [htmlLyricThird, setHtmlLyricThird] = useState<any>()
  const [htmlLyricNextMusic, setHtmlLyricNextMusic] = useState<any>()

  const heightScreen = window.innerHeight - 160
  const lines = heightScreen / 15

  const processNotes = (notesContent: any, offset: any) => {
    return notesContent.split('/').map((note: any) => {
      const matchResult = note.match(/[A-G]#?b?/);
      if (!matchResult) {
        return note; 
      }
  
      let originalNote = note.match(/[A-G]#?b?/)[0];
      let additionalDetails = note.substr(originalNote.length);

      let isB = originalNote.includes("b");

      // Converta bemóis para seus equivalentes sustenidos
      if (isB) {
        switch (originalNote.substr(0, 2)) {
          case "Bb":
            originalNote = "A#";
            break;
          case "Db":
            originalNote = "C#";
            break;
          case "Eb":
            originalNote = "D#";
            break;
          case "Gb":
            originalNote = "F#";
            break;
          case "Ab":
            originalNote = "G#";
            break;
          default:
            break;
        }
      }

      if (offset !== 0) {
        // Encontre a nova nota somente se o offset for diferente de zero
        let indexInScaleNote = scaleNotes.indexOf(originalNote);
        let resultOffsetAndIndexNoteNow = indexInScaleNote + offset;

        // Ajuste para casos onde o índice excede o tamanho da escala ou é negativo
        resultOffsetAndIndexNoteNow = (resultOffsetAndIndexNoteNow + scaleNotes.length) % scaleNotes.length;

        originalNote = scaleNotes[resultOffsetAndIndexNoteNow];
      }

      return originalNote + additionalDetails; // Junta a nova nota com os detalhes adicionais
    }).join('/');
  };

  useEffect(() => {
    if (lyricToShow) {
      let lyric = lyricToShow.lyric

      let nextLyric;
      if (nextLyricToShow) nextLyric = nextLyricToShow.lyric;

      // Change Scale of Primary Lyric
      let create = document.createElement("div")
      create.innerHTML = lyric
      let arrayOfNotes = create.getElementsByTagName("b")

      if (offsetLyricToShow !== 0) {
        for (let i = 0; i < arrayOfNotes.length; i++) {
          arrayOfNotes[i].innerHTML = processNotes(arrayOfNotes[i].textContent, offsetLyricToShow);
        }
      }

      // Apply offset changes in the current lyric
      lyric = create.outerHTML

      // Change Scale of Secondary Lyric
      if (nextLyricToShow) {
        let createSecondary = document.createElement("div")
        createSecondary.innerHTML = nextLyric
        let arrayOfNotesSecondary = createSecondary.getElementsByTagName("b")

        if (nextLyricToShow.offset !== 0) {
          for (let i = 0; i < arrayOfNotesSecondary.length; i++) {
            arrayOfNotesSecondary[i].innerHTML = processNotes(arrayOfNotesSecondary[i].textContent, nextLyricToShow.offset);
          }
        }

        // Apply offset changes in the current lyric
        nextLyric = createSecondary.outerHTML
      }

      // Habilite or no the solo
      if (habiliteSolo) {
        let create = document.createElement("div")
        create.innerHTML = lyric

        for (var i = 0; i < create.getElementsByTagName("span").length; i++) {
          var sidebarAd = create.getElementsByTagName("span")[i];
          sidebarAd.parentNode?.removeChild(sidebarAd);
        }
        for (var i = 0; i < create.getElementsByTagName("span").length; i++) {
          var sidebarAd = create.getElementsByTagName("span")[i];
          sidebarAd.parentNode?.removeChild(sidebarAd);
        }

        lyric = create.outerHTML
      }

      /**
       * Next lyric
       */

      // Remove solo of lyric
      if (habiliteSolo && nextLyric) {
        let create = document.createElement("div")
        create.innerHTML = nextLyric

        for (var i = 0; i < create.getElementsByTagName("span").length; i++) {
          var sidebarAd = create.getElementsByTagName("span")[i];
          sidebarAd.parentNode?.removeChild(sidebarAd);
        }
        for (var i = 0; i < create.getElementsByTagName("span").length; i++) {
          var sidebarAd = create.getElementsByTagName("span")[i];
          sidebarAd.parentNode?.removeChild(sidebarAd);
        }

        nextLyric = create.outerHTML
      }


      /**
       * End
       */

      let arrayOfLyric = lyric.split('\n')
      arrayOfLyric.map((value: string, index: number) => {
        if (value.includes("<b")) {

        }
      })
      let lengthTotalLines = lyric.split(/\r\n|\r|\n/).length

      // Setting the lines for the columns
      let firstColumnLinesStart = lines
      let firstColumnLinesEnd = lines * 2
      let firstColumn = arrayOfLyric.slice(0, firstColumnLinesStart)

      let secondColumn, thirdColumn;

      const moveNotesToNextColumn = (currentColumn: any, nextColumn: any) => {
        if (currentColumn.length > 0 && currentColumn[currentColumn.length - 1].includes("<b")) {
          // Se a última linha for uma nota, mova para a próxima coluna
          const note = currentColumn.pop();
          if (nextColumn) {
            nextColumn.unshift(note);
          }
        }
      };

      if (firstColumnLinesStart < arrayOfLyric.length) {
        secondColumn = arrayOfLyric.slice(firstColumnLinesStart, firstColumnLinesEnd);
        moveNotesToNextColumn(firstColumn, secondColumn);
        setLengthSecondColumn(secondColumn.join('\n').split(/\r\n|\r|\n/).length);
      }

      if (firstColumnLinesEnd < arrayOfLyric.length) {
        thirdColumn = arrayOfLyric.slice(firstColumnLinesEnd);
        moveNotesToNextColumn(secondColumn, thirdColumn);
      }

      firstColumn.push('</pre>')

      if (secondColumn) {
        secondColumn.unshift('<pre>')
        secondColumn.push('</pre>')
        setHtmlLyricSecond(secondColumn.join('\n'))
      }

      if (thirdColumn) {
        thirdColumn.unshift('<pre>')
        setHtmlLyricThird(thirdColumn.join('\n'))
      }

      setHtmlLyric(firstColumn.join('\n'))

      // Next Music To Show
      if (nextLyric) {
        let arrayOfNextLyric = nextLyric.split('\n')

        let columnNextMusic = arrayOfNextLyric.splice(0, 20)
        columnNextMusic.push('</pre>')
        setHtmlLyricNextMusic(columnNextMusic.join('\n'))

      }
    }
  }, [lyricToShow, habiliteSolo])

  return {
    htmlLyric,
    htmlLyricSecond,
    htmlLyricThird,
    htmlLyricNextMusic,
    lengthSecondColumn
  }
}