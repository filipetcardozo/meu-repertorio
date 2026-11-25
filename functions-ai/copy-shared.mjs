// Copia do app (src/) o código usado pelas Functions, para não duplicar: a busca de letra, a junção
// com IA e os utilitários de acorde. O resultado (src/shared/) é gerado a cada build e fica fora do git.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', 'src');
const out = join(here, 'src', 'shared');

const FILES = [
  'lib/lyricsSearch.ts',
  'lib/httpError.ts',
  'lib/ai/provider.ts',
  'lib/ai/mergeCifra.ts',
  'lib/ai/cifraText.ts',
  'lib/ai/improveCifra.ts',
  'utils/chords/parseChord.ts',
  'utils/chords/transpose.ts',
  'utils/simplifyChordSheet.ts',
];

rmSync(out, { recursive: true, force: true });
for (const f of FILES) {
  mkdirSync(dirname(join(out, f)), { recursive: true });
  cpSync(join(app, f), join(out, f));
}
console.log(`copiados ${FILES.length} arquivos de src/ para functions-ai/src/shared`);
