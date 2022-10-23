const scaleNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export function writeTone(lyricToShow: any) {
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

    let resultOffsetAndIndexNoteNow = indexInScaleNote + lyricToShow.offset
    let restOfResult = resultOffsetAndIndexNoteNow - 11

    // If it is greater than 11 or less
    if (restOfResult > 0) resultOffsetAndIndexNoteNow = restOfResult - 1
    if (resultOffsetAndIndexNoteNow < 0) resultOffsetAndIndexNoteNow = 12 + resultOffsetAndIndexNoteNow

    let newNote = scaleNotes[resultOffsetAndIndexNoteNow]
    if (isMinor) newNote += "m"


    return newNote
}