/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { transposeChordSheetElement } from '../utils/chords/transpose'

/**
 * Prepara o HTML da cifra: muda o tom dos acordes e mostra ou esconde as tablaturas
 * (`<span class="tablatura">`). Devolve o HTML embrulhado num <div>, como o resto do hook espera.
 */
function prepareLyricHtml(html: string | undefined, offset: number, originalTone: string | undefined, showTabs: boolean) {
  if (html == null) return undefined;
  const container = document.createElement('div');
  container.innerHTML = html;
  transposeChordSheetElement(container, offset, originalTone);
  const spans = container.querySelectorAll('span');
  if (!showTabs) {
    spans.forEach((el) => el.remove());
    // As linhas da tablatura viram linhas vazias: junta para não sobrar buracos na cifra.
    return container.outerHTML.replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, '\n\n');
  }
  // A cifra é dividida em colunas linha a linha: um <span> que atravessa várias linhas
  // perderia a classe ao ser cortado. Cada linha ganha o seu próprio <span>.
  spans.forEach((el) => {
    const parts = el.innerHTML.split('\n');
    if (parts.length < 2) return;
    const cls = el.getAttribute('class') ?? '';
    const tmp = document.createElement('div');
    tmp.innerHTML = parts.map((line) => (line ? `<span class="${cls}">${line}</span>` : '')).join('\n');
    el.replaceWith(...Array.from(tmp.childNodes));
  });
  return container.outerHTML;
}

/** Se a cifra tem tablatura (para mostrar o botão de ligar/desligar). */
export const lyricHasTabs = (html: string | undefined) => !!html && /<span[\s>]/i.test(html);

export const useLyricShow = ({
  lyricToShow,
  offsetLyricToShow,
  nextLyricToShow,
  singleColumn = false,
  showTabs = true,
}: any) => {
  const [lengthSecondColumn, setLengthSecondColumn] = useState(0)

  const [htmlLyric, setHtmlLyric] = useState<any>()
  const [htmlLyricSecond, setHtmlLyricSecond] = useState<any>()
  const [htmlLyricThird, setHtmlLyricThird] = useState<any>()
  const [htmlLyricNextMusic, setHtmlLyricNextMusic] = useState<any>()

  const heightScreen = window.innerHeight - 160
  // No mobile a cifra fica numa coluna só, com rolagem vertical natural.
  const lines = singleColumn ? Infinity : heightScreen / 15

  // Tom e solos: refeito só quando a cifra, o tom ou o offset mudam.
  const preparedLyric = useMemo(
    () => prepareLyricHtml(lyricToShow?.lyric, offsetLyricToShow ?? 0, lyricToShow?.originalTone, showTabs),
    [lyricToShow?.lyric, lyricToShow?.originalTone, offsetLyricToShow, showTabs],
  )
  const preparedNextLyric = useMemo(
    () => prepareLyricHtml(nextLyricToShow?.lyric, nextLyricToShow?.offset ?? 0, nextLyricToShow?.originalTone, showTabs),
    [nextLyricToShow?.lyric, nextLyricToShow?.originalTone, nextLyricToShow?.offset, showTabs],
  )

  useEffect(() => {
    if (lyricToShow && preparedLyric !== undefined) {
      // Limpa as colunas da música anterior antes de recalcular
      setHtmlLyricSecond(undefined)
      setHtmlLyricThird(undefined)
      setHtmlLyricNextMusic(undefined)
      setLengthSecondColumn(0)

      const lyric = preparedLyric ?? ''
      const nextLyric = nextLyricToShow ? preparedNextLyric : undefined

      let arrayOfLyric = lyric.split('\n')

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
  }, [preparedLyric, preparedNextLyric, showTabs, singleColumn])

  return {
    htmlLyric,
    htmlLyricSecond,
    htmlLyricThird,
    htmlLyricNextMusic,
    lengthSecondColumn
  }
}