// Copia bibliotecas que precisam ser servidas SEM passar pelo bundler para public/vendor.
// signalsmith-stretch: monta o AudioWorklet a partir do texto do próprio código; o bundler
// injeta polyfills (ex.: `process`) que não existem dentro do worklet e quebram o player.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'vendor');
mkdirSync(out, { recursive: true });
// o pacote só exporta o ponto de entrada; o .js (require) fica na mesma pasta do .mjs
const src = join(dirname(require.resolve('signalsmith-stretch')), 'SignalsmithStretch.mjs');
copyFileSync(src, join(out, 'signalsmith-stretch.js'));
console.log('vendor: signalsmith-stretch copiado para public/vendor');
