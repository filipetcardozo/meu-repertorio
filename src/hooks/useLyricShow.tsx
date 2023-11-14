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

  function moveMusicalNotesToNextColumn(currentColumn: any, nextColumn: any) {
    if (!currentColumn || currentColumn.length === 0) return [currentColumn, nextColumn];

    const lastLine = currentColumn[currentColumn.length - 1];
    if (lastLine.includes("<b")) {
      // Remova a última linha da coluna atual e adicione-a ao início da próxima coluna
      return [
        currentColumn.slice(0, -1),
        [lastLine].concat(nextColumn)
      ];
    }
    return [currentColumn, nextColumn];
  }

  useEffect(() => {
    if (lyricToShow) {
      let lyric = lyricToShow.lyric

      let nextLyric;
      if (nextLyricToShow) nextLyric = nextLyricToShow.lyric;

      // Change Scale of Primary Lyric
      let create = document.createElement("div")
      create.innerHTML = lyric
      let arrayOfNotes = create.getElementsByTagName("b")

      if (!(offsetLyricToShow === undefined)) {
        for (let i = 0; i < arrayOfNotes.length; i++) {
          let nowNote: any = arrayOfNotes[i].textContent
          // nowNote = "B"

          let isCharp = nowNote?.charAt(1) == "#"
          let isB = nowNote?.charAt(1) == "b"

          // Get just a note || get the # too
          if (!isCharp && !isB) nowNote = nowNote?.charAt(0)

          let oldNote = ""
          if (isB) {
            switch (nowNote.substr(0, 2)) {
              case "Bb":
                nowNote = "A#"
                oldNote = "Bb"
                break;
              case "Db":
                nowNote = "C#"
                oldNote = "Db"
                break;
              case "Eb":
                nowNote = "D#"
                oldNote = "Eb"
                break;
              case "Gb":
                nowNote = "F#"
                oldNote = "Gb"
                break;
              case "Ab":
                nowNote = "G#"
                oldNote = "Ab"
                break;
            }
          }


          if (isCharp) nowNote = nowNote?.substr(0, 2)
          // New tests

          // Index in slace note
          let indexInScaleNote = scaleNotes.indexOf(nowNote)

          let resultOffsetAndIndexNoteNow = indexInScaleNote + offsetLyricToShow
          let restOfResult = resultOffsetAndIndexNoteNow - 11

          // If it is greater than 11 or less
          if (restOfResult > 0) resultOffsetAndIndexNoteNow = restOfResult - 1
          if (resultOffsetAndIndexNoteNow < 0) resultOffsetAndIndexNoteNow = 12 + resultOffsetAndIndexNoteNow

          let newNote = scaleNotes[resultOffsetAndIndexNoteNow]

          // let allNewNote = String(arrayOfNotes[i].textContent).replace(nowNote, newNote)
          let allNewNote: string
          if (isB) {
            allNewNote = String(arrayOfNotes[i].textContent).replace(oldNote, newNote)
          } else {
            allNewNote = String(arrayOfNotes[i].textContent).replace(nowNote, newNote)
          }
          // = String(arrayOfNotes[i].textContent).replace(nowNote, newNote)

          arrayOfNotes[i].innerHTML = allNewNote
        }
      }

      // Apply offset changes in the current lyric
      lyric = create.outerHTML

      // Change Scale of Secondary Lyric
      if (nextLyricToShow) {
        let createSecondary = document.createElement("div")
        createSecondary.innerHTML = nextLyric
        let arrayOfNotes = createSecondary.getElementsByTagName("b")

        for (let i = 0; i < arrayOfNotes.length; i++) {
          let nowNote: any = arrayOfNotes[i].textContent
          // nowNote = "B"

          let isCharp = nowNote?.charAt(1) == "#"
          let isB = nowNote?.charAt(1) == "b"

          // Get just a note || get the # too
          if (!isCharp && !isB) nowNote = nowNote?.charAt(0)

          let oldNote = ""
          if (isB) {
            switch (nowNote.substr(0, 2)) {
              case "Bb":
                nowNote = "A#"
                oldNote = "Bb"
                break;
              case "Db":
                nowNote = "C#"
                oldNote = "Db"
                break;
              case "Eb":
                nowNote = "D#"
                oldNote = "Eb"
                break;
              case "Gb":
                nowNote = "F#"
                oldNote = "Gb"
                break;
              case "Ab":
                nowNote = "G#"
                oldNote = "Ab"
                break;
            }
          }


          if (isCharp) nowNote = nowNote?.substr(0, 2)
          // New tests

          // Index in slace note
          let indexInScaleNote = scaleNotes.indexOf(nowNote)

          let resultOffsetAndIndexNoteNow = indexInScaleNote + nextLyricToShow.offset
          let restOfResult = resultOffsetAndIndexNoteNow - 11

          // If it is greater than 11 or less
          if (restOfResult > 0) resultOffsetAndIndexNoteNow = restOfResult - 1
          if (resultOffsetAndIndexNoteNow < 0) resultOffsetAndIndexNoteNow = 12 + resultOffsetAndIndexNoteNow

          let newNote = scaleNotes[resultOffsetAndIndexNoteNow]

          // let allNewNote = String(arrayOfNotes[i].textContent).replace(nowNote, newNote)
          let allNewNote: string
          if (isB) {
            allNewNote = String(arrayOfNotes[i].textContent).replace(oldNote, newNote)
          } else {
            allNewNote = String(arrayOfNotes[i].textContent).replace(nowNote, newNote)
          }
          // = String(arrayOfNotes[i].textContent).replace(nowNote, newNote)

          arrayOfNotes[i].innerHTML = allNewNote
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

      let secondColumn;
      if (firstColumnLinesStart < arrayOfLyric.length) {
        secondColumn = arrayOfLyric.slice(firstColumnLinesStart, firstColumnLinesEnd)
        // Length of second Column
        setLengthSecondColumn(secondColumn.join('\n').split(/\r\n|\r|\n/).length)
      }

      let thirdColumn;
      if (firstColumnLinesEnd < arrayOfLyric.length) {
        thirdColumn = arrayOfLyric.slice(firstColumnLinesEnd)
      }

      [firstColumn, secondColumn] = moveMusicalNotesToNextColumn(firstColumn, secondColumn);
      [secondColumn, thirdColumn] = moveMusicalNotesToNextColumn(secondColumn, thirdColumn);    

      if (firstColumn) {
        firstColumn.unshift('<pre>');
        firstColumn.push('</pre>');
        setHtmlLyric(firstColumn.join('\n'));
      }

      if (secondColumn) {
        secondColumn.unshift('<pre>')
        secondColumn.push('</pre>')
        setHtmlLyricSecond(secondColumn.join('\n'))
      }

      if (thirdColumn) {
        thirdColumn.unshift('<pre>')
        thirdColumn.push('</pre>');
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