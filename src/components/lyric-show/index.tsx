import { useEffect, useState } from "react"
import { Markup } from 'interweave';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography'
import NextPlanIcon from '@mui/icons-material/NextPlan';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Stack from "@mui/material/Stack"
import Badge from '@mui/material/Badge';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';

const scaleNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: theme.palette.common.white,
        color: 'rgba(0, 0, 0, 0.87)',
        boxShadow: theme.shadows[1],
        fontSize: 11,
    },
}));

export const LyricShow = (params: any) => {
    let lyricToShow: any = params.lyricToShow
    let nextLyricToShow = params.nextLyricToShow
    let setSheetMusic = params.setSheetMusic
    let sheetMusic = params.sheetMusic
    let changeOffSet = params.changeOffSet
    let offsetLyricToShow = params.lyricToShow.offset
    let offsetsUpdateds = params.offsetsUpdateds
    let updateOffset = params.updateOffset
    let offsetIsUpdating = params.offsetIsUpdating

    // Show in some columns
    let heightScreen = window.innerHeight - 160
    let lines = heightScreen / 15
    let [htmlLyric, setHtmlLyric] = useState<any>()
    let [htmlLyricSecond, setHtmlLyricSecond] = useState<any>()
    let [htmlLyricThird, setHtmlLyricThird] = useState<any>()
    let [htmlLyricNextMusic, setHtmlLyricNextMusic] = useState<any>()

    const [habiliteSolo, setHabiliteSolo] = useState(true)
    const [lengthSecondColumn, setLengthSecondColumn] = useState(0)

    useEffect(() => {
        if (lyricToShow) {
            let lyric = lyricToShow.lyric

            let nextLyric;
            if (nextLyricToShow) nextLyric = nextLyricToShow.lyric;

            console.log(nextLyricToShow)

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
             * End next lyric
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
            let secondColumnLinesEnd = lines * 3

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

    function writeTone() {
        let originalTone = lyricToShow.originalTone

        let nowTone = originalTone
        // nowNote = "B"

        let isCharp = nowTone?.charAt(1) == "#"
        let isB = nowTone?.charAt(1) == "b"
        let isMinor = nowTone?.includes("m")

        // Get just a note || get the # too
        if (!isCharp && !isB) nowTone = nowTone?.charAt(0)

        if (isB) {
            switch (nowTone.substr(0, 2)) {
                case "Bb":
                    nowTone = "A#"
                    break;
                case "Db":
                    nowTone = "C#"
                    break;
                case "Eb":
                    nowTone = "D#"
                    break;
                case "Gb":
                    nowTone = "F#"
                    break;
                case "Ab":
                    nowTone = "G#"
                    break;
            }
        }

        if (isCharp) nowTone = nowTone?.substr(0, 2)

        // Index in slace note
        let indexInScaleNote = scaleNotes.indexOf(nowTone)

        let resultOffsetAndIndexNoteNow = indexInScaleNote + offsetLyricToShow
        let restOfResult = resultOffsetAndIndexNoteNow - 11

        // If it is greater than 11 or less
        if (restOfResult > 0) resultOffsetAndIndexNoteNow = restOfResult - 1
        if (resultOffsetAndIndexNoteNow < 0) resultOffsetAndIndexNoteNow = 12 + resultOffsetAndIndexNoteNow

        let newNote = scaleNotes[resultOffsetAndIndexNoteNow]
        if (isMinor) newNote += "m"


        return newNote
    }

    function htmlContent() {
        if (htmlLyric) return <Box display="inline" className="lyric-show">
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                <Typography variant="h6" fontSize={15}>
                    {lyricToShow.lyricName + " "}
                    <Box component="span" fontSize={11}>
                        ({lyricToShow.composerName})
                    </Box>
                </Typography>
                <Badge color="info"
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: lyricToShow.offset > 0 ? "right" : "left",
                    }}
                    badgeContent={offsetLyricToShow > 0 ? "+" + offsetLyricToShow : offsetLyricToShow}>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0}
                        sx={{
                            border: "1px solid #1976d24a",
                            borderRadius: 3
                        }}>
                        <IconButton aria-label="delete" size="small" onClick={() => { changeOffSet(false) }}>
                            <RemoveIcon sx={{ color: "#1976d2a1" }} fontSize="inherit" />
                        </IconButton>
                        <Box display="flex" alignItems="center" justifyContent="center" style={{ width: "25px", height: "25px", color: "#1976d2" }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ pt: 0.2 }} fontSize={13} color="#1976d2a1">{writeTone()}</Typography>
                        </Box>
                        <IconButton aria-label="delete" size="small" onClick={() => { changeOffSet(true) }}>
                            <AddIcon sx={{ color: "#1976d2a1" }} fontSize="inherit" />
                        </IconButton>
                    </Stack>
                    {
                        offsetsUpdateds.offsetChanged ?
                            offsetIsUpdating ?
                                <CircularProgress
                                    size={12}
                                    sx={{
                                        color: "primary",
                                        position: "absolute", right: 34, bottom: 35,

                                    }}
                                />
                                :
                                <IconButton size="small" className="blob"
                                    sx={{
                                        color: "#1976d2", position: "absolute", right: 27, bottom: 28,
                                    }}
                                    onClick={() => updateOffset()}
                                >
                                    <LightTooltip title="Salvar novo tom" placement="top">
                                        <SaveAsIcon fontSize="inherit" />
                                    </LightTooltip>
                                </IconButton>
                            :
                            <></>
                    }

                </Badge>
            </Stack>


            {/* <Typography variant="h6" fontSize={16} mt={0.3} color="primary">C</Typography>
                    <IconButton size="small" color="primary">
                        <MdExpandLess />
                    </IconButton> */}

            <Markup content={htmlLyric} />
        </Box >
    }

    function htmlContentSecond() {
        if (!htmlLyricSecond) return htmlNextMusic();

        if (htmlLyricSecond) return <Box display="inline">
            <Markup content={htmlLyricSecond} />
            {lengthSecondColumn < 20 ? htmlNextMusic() : ""}
        </Box>
    }

    function htmlContentThird() {
        if (!htmlLyricThird && lengthSecondColumn >= 20) return htmlNextMusic();

        if (htmlLyricThird) return <Box display="inline">
            <Markup content={htmlLyricThird} />
            {htmlNextMusic()}
        </Box>
    }
    
    function htmlNextMusic() {
        if (htmlLyricNextMusic) return <Box display="inline" color="#00000066">
            <Box justifyContent="center" >
                <Box textAlign="center">
                    <Fab size="small" onClick={() => params.handleNext()} variant="extended">
                        <NextPlanIcon sx={{ mr: 1 }} />
                        Próxima música
                    </Fab>
                </Box>
            </Box>

            <Typography variant="h6">{nextLyricToShow.lyricName} <Box component="span" fontSize={14}> ({nextLyricToShow.composerName})</Box></Typography>
            <Markup content={htmlLyricNextMusic} />
        </Box>
    }

    return <>
        {/* <Button variant="outlined" onClick={() => setHabiliteSolo(!habiliteSolo)}>
            Mostrar solo
        </Button> */}
        <Box sx={{ display: "flex", fontSize: "14px", lineHeight: "15px", gap: 4, fontFamily: "monospace" }}>
            {htmlContent()}
            {htmlContentSecond()}
            {htmlContentThird()}
        </Box >
    </>
}