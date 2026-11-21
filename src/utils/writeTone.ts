import { transposeKey } from './chords/transpose'

/** Tom atual da música (tom cadastrado + offset). null quando não há tom válido cadastrado. */
export function writeTone(lyricToShow: { originalTone?: string | null; offset?: number | null } | null | undefined): string | null {
    return transposeKey(lyricToShow?.originalTone, lyricToShow?.offset ?? 0)
}
