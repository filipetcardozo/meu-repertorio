/**
 * Ritmos do "tocar junto": o que cada músico da banda toca com o acorde atual.
 *
 * Cada instrumento tem a própria levada (como numa banda de verdade: o violão não toca igual ao
 * cavaco) e algumas variações; a banda vai alternando entre elas de compasso em compasso.
 * A primeira variação de cada lista é a "levada principal" (a mais usada).
 *
 * Um compasso tem `beats` tempos de `sub` passos. Cada caractere é um passo:
 *
 * Violão, cavaco, banjo, ukulele, guitarra, teclado:
 *   D  batida para baixo (forte)       d  para baixo (fraca)
 *   U  batida para cima (forte)        u  para cima (fraca)
 *   x  abafada ("tchá")                s  curta (staccato, ex.: reggae)
 *   B  baixo (polegar)                 b  baixo alternado
 *   T  três agudas juntas (dedos)      P  pinça: baixo + agudas juntos
 *   1 2 3  uma corda aguda (1 = a mais grave das três)
 *   .  pausa
 *   (no teclado: B/b = mão esquerda, T = acorde da mão direita, P = os dois juntos)
 * Baixo:   R raiz  r raiz fraca  5 quinta  8 oitava  3 terça  7 sétima  . pausa
 * Sanfona: S acorde segurado  c acorde curto  B baixo  b baixo na quinta  - segura  . solta
 * Bateria (kit): uma linha por peça (ver `DrumId`): X forte  x normal  g fantasma  . pausa
 * Percussão: uma linha por instrumento: X forte  x normal  g fantasma/abafado  . pausa
 *   surdo/zabumba: g = abafado      triângulo: X = aberto, x = fechado
 *   rebolo: O aberto forte  o aberto  m abafado
 *   pandeiro: G grave aberto  g grave abafado (polegar)  p platinela  P platinela forte (tapa)
 *
 * A virada (`fill`) só toca quando a pessoa pede (espaço ou o botão "Virada").
 * Para adicionar um ritmo ou uma variação, basta incluir aqui.
 */
import type { StrokeOptions } from './chordAudio';
import type { BandPartId, DrumId, PercId } from './band';

export type DrumGroove = Partial<Record<DrumId, string>>;
export type MelodicPartId = Exclude<BandPartId, 'bateria' | PercId>;

export type Rhythm = {
  id: string;
  name: string;
  /** Como fica a batida, para mostrar no menu. */
  hint: string;
  /** Tempos por compasso e passos por tempo (1 = semínimas, 2 = colcheias, 4 = semicolcheias). */
  beats: number;
  sub: 1 | 2 | 4;
  /** Balanço: quanto os passos do contratempo atrasam (fração do passo). Samba e bossa têm um pouco. */
  swing?: number;
  /** Levadas de cada instrumento (a primeira é a principal). */
  parts: Partial<Record<MelodicPartId, string[]>>;
  /** Grooves da bateria (kit); o primeiro é o principal. Ritmo sem bateria não tem kit. */
  drums?: DrumGroove[];
  /** Levadas da percussão; só os percussionistas listados tocam neste ritmo. */
  perc?: Partial<Record<PercId, string[]>>;
  /** Virada (compasso inteiro; se pedida no meio do compasso, toca só o final). */
  fill?: { drums?: DrumGroove; perc?: Partial<Record<PercId, string>> };
};

export const RHYTHMS: Rhythm[] = [
  {
    id: 'simples', name: 'Simples', hint: '↓ ↓ ↓ ↓', beats: 4, sub: 1,
    parts: {
      violao: ['Dddd', 'Dd.d', 'DdDd'],
      cavaquinho: ['.d.d', 'dddd'],
      ukulele: ['Dddd', 'D.dd'],
      guitarra: ['D...', 'D.d.'],
      teclado: ['P.T.', 'P...', 'PTTT'],
      sanfona: ['S---', 'S-c-'],
      baixo: ['R.5.', 'R...', 'R.8.'],
    },
    drums: [{ k: 'x.x.', s: '.X.X', h: 'xxxx' }, { k: 'x.xx', s: '.X.X', h: 'xxxx' }],
    fill: { drums: { k: 'x...', s: '.xXX' } },
  },
  {
    id: 'balada', name: 'Balada', hint: '↓ ↓↑ ↑↓↑', beats: 4, sub: 2,
    parts: {
      violao: ['D.Du.uDu', 'D.Du.udu', 'D.D.DuDu', 'D.Du.uDd'],
      cavaquinho: ['..d...du', '..du..d.', '.ud...du'],
      ukulele: ['D.DU.UDU', 'D.DUDUDU', 'D.D.DUDU'],
      guitarra: ['D.......', 'D...d...', 'D.....d.'],
      teclado: ['P...T...', 'P...T.T.', 'P.....T.', 'P..T..T.'],
      sanfona: ['S-------', 'S---S---', 'S-----c.'],
      baixo: ['R...R.5.', 'R.....5.', 'R...5...', 'R..R..5.'],
    },
    drums: [
      { k: 'x...x.x.', s: '..X...X.', h: 'XxXxXxXx' },
      { k: 'x..x..x.', s: '..X...X.', h: 'XxXxXxXx' },
      { k: 'x...x...', s: '..X...Xg', h: 'XxXxXxXo' },
    ],
    fill: { drums: { k: 'x...x...', s: '..X.xXXX', h: 'XxXx....' } },
  },
  {
    id: 'pop', name: 'Pop / rock', hint: '↓↑↓↑ ↓↑↓↑', beats: 4, sub: 2,
    parts: {
      violao: ['DuduDudu', 'D.duDudu', 'DuduD.du', 'D.du.udu'],
      cavaquinho: ['.u.u.u.u', 'du.udu.u'],
      ukulele: ['D.DU.UDU', 'DuDuDuDu'],
      guitarra: ['D.D.D.D.', 'D.DuD.Du', 'D..D..D.'],
      teclado: ['D..D..D.', 'P..T..T.', 'D..D.D..'],
      sanfona: ['S---S---', 'S..cS.c.'],
      baixo: ['RrRrRrRr', 'R.RrR.5r', 'RrRr5r8r', 'R..R..R.'],
    },
    drums: [
      { k: 'x...xx..', s: '..X...X.', h: 'xxxxxxxx' },
      { k: 'x..xx...', s: '..X...X.', h: 'xxxxxxxx' },
      { k: 'x...x.x.', s: '..X...X.', h: 'XxXxXxXo' },
    ],
    fill: { drums: { k: 'x.......', s: '..XxXxXX', h: 'xx......' } },
  },
  {
    id: 'pop-abafado', name: 'Pop abafado', hint: '↓ ✕↑ ↑ ✕↑', beats: 4, sub: 2,
    parts: {
      violao: ['D.xu.uxu', 'D.xuDuxu', 'D.xu.uxd'],
      cavaquinho: ['..x...x.', '.uxu.ux.'],
      ukulele: ['D.xU.Uxu', 'DuxuDuxu'],
      guitarra: ['..s...s.', '..s..ss.'],
      teclado: ['P..T..T.', '..T...T.'],
      sanfona: ['S---S---', 'c..c..c.'],
      baixo: ['R..RR.5.', 'R..R..5.', 'R..RR.8.'],
    },
    drums: [
      { k: 'x..x..x.', s: '..X...X.', h: 'xxxxxxxx' },
      { k: 'x..x.xx.', s: '..X...X.', h: 'xxxxxxxx' },
    ],
    fill: { drums: { k: 'x..x....', s: '..X.XXXX' } },
  },
  {
    id: 'sertanejo', name: 'Sertanejo', hint: 'baixo ↓↑ baixo ↓↑', beats: 4, sub: 2,
    parts: {
      violao: ['B.dub.du', 'B.duB.du', 'B.dub.dU', 'B.dubudu'],
      cavaquinho: ['..d...d.', '..du..du'],
      ukulele: ['.udu.udu'],
      guitarra: ['D...d...', 'D.....d.'],
      teclado: ['P...T...', '..T...T.'],
      sanfona: ['S---S---', 'S-c-S-c-', 'B.c.b.c.'],
      baixo: ['R...5...', 'R...5.5.', 'R..R5...'],
    },
    drums: [
      { k: 'x...x...', s: '..X...X.', h: '.x.x.x.x' },
      { k: 'x..xx...', s: '..X...X.', h: '.x.x.x.x' },
    ],
    perc: { ganza: ['XxxxXxxx', 'xxXxxxXx'] },
    fill: { drums: { k: 'x...x...', s: '..X.XXXX' } },
  },
  {
    id: 'reggae', name: 'Reggae', hint: 'no contratempo', beats: 4, sub: 2, swing: 0.12,
    parts: {
      violao: ['.s.s.s.s', '.s.s.sss'],
      cavaquinho: ['..s...s.'],
      ukulele: ['.s.s.s.s'],
      guitarra: ['..s...s.', '..s..ss.'],
      teclado: ['.s.s.s.s', '.sss.s.s'],
      sanfona: ['.c.c.c.c', '...c...c'],
      baixo: ['R..R..5.', 'R.....5.', '...R.R5.'],
    },
    drums: [
      { k: '....X...', r: '....x...', h: 'xgxgxgxg' },
      { k: '....X...', r: '....x...', h: 'x.xgx.xg' },
    ],
    fill: { drums: { k: '....X...', s: '....x.XX' } },
  },
  {
    // Samba de roda/partido: só percussão, violão no polegar e dedos, cavaco na levada.
    id: 'samba', name: 'Samba', hint: '2/4 · surdo, pandeiro, tamborim', beats: 2, sub: 4, swing: 0.1,
    parts: {
      violao: ['P.TTbT.T', 'P.T.bTTT', 'P..TbT.T', 'P.TTb.TT'],
      cavaquinho: ['D.dU.dUd', 'D.dUd.Ud', 'DudU.dUd'],
      banjo: ['.udU.udU', 'D.dU.udU'],
      ukulele: ['D.dU.dU.'],
      guitarra: ['..T...T.', '.T.T.T..'],
      teclado: ['..T..T.T', 'T..T..T.'],
      sanfona: ['S---S---', 'c..c..c.'],
      baixo: ['R...5..5', 'R..R5..5', 'R...5.R.', 'R.R.5..5'],
    },
    perc: {
      surdo: ['g...X...', 'g...X..g', 'g..gX...'],
      pandeiro: ['gppPGppP', 'gppPGpPP', 'gpPpGppP'],
      tamborim: ['X.xX.x.x', '.x.x.xX.', 'X.xX.xX.'],
      ganza: ['XxxxXxxx', 'xxXxxxXx'],
    },
    fill: { perc: { surdo: '....X.XX', pandeiro: 'gppPPPPP', tamborim: 'XxXxXXXX' } },
  },
  {
    // Pagode: banjo e cavaco na levada, violão de 7 nos baixos, e a "cozinha" de percussão
    // (surdo marcando, rebolo respondendo, pandeiro conduzindo, tamborim desenhando).
    id: 'pagode', name: 'Pagode', hint: '2/4 · banjo, rebolo, pandeiro, tamborim', beats: 2, sub: 4, swing: 0.12,
    parts: {
      banjo: ['.udU.udU', 'DudU.udU', '.udUDudU'],
      cavaquinho: ['DudUdudU', 'D.dUdudU', 'DudUD.dU'],
      violao: ['B..bB.T.', 'B.TbB..T', 'B..bBbT.'],
      ukulele: ['.udU.udU'],
      guitarra: ['..T...T.'],
      teclado: ['T.......', 'T...T...', '...T..T.'],
      sanfona: ['S-------'],
      baixo: ['R...5..5', 'R..R5..R', 'R...5.R.', 'R..85..5'],
    },
    perc: {
      surdo: ['g...X...', 'g...X...', 'g..gX...'],
      rebolo: ['..o.m.O.', '..o.m.OO', 'o.o.m.O.', '..O.m.oO'],
      pandeiro: ['gppPGppP', 'gppPGpPP', 'gpPpGppP'],
      tamborim: ['X.xX.x.x', '.x.x.xX.', 'X.xX.xX.'],
      ganza: ['XxxxXxxx', 'xxXxxxXx'],
    },
    fill: { perc: { surdo: '....X.XX', rebolo: 'O.OoOoOO', pandeiro: 'gppPPPPP', tamborim: 'XxXxXXXX' } },
  },
  {
    id: 'bossa', name: 'Bossa nova', hint: 'polegar + dedos sincopados', beats: 4, sub: 4, swing: 0.06,
    parts: {
      violao: ['P..Tb.T.B.T.bT..', 'P..Tb.T.B..Tb.T.', 'P..Tb..TB.T.b.T.'],
      cavaquinho: ['..T...T...T...T.'],
      ukulele: ['T..T..T...T..T..'],
      guitarra: ['T.......T.......', 'T.....T.T.......'],
      teclado: ['..T..T....T..T..', 'T..T..T...T.....', '...T..T...T..T..'],
      sanfona: ['S-------S-------', 'S---------------'],
      baixo: ['R.....5.R.....5.', 'R.....5.5.....R.', 'R.....8.5.....5.'],
    },
    drums: [
      { k: 'x..x....x..x....', r: 'x..x..x...x..x..', h: 'gggggggggggggggg' },
      { k: 'x......xx.......', r: 'x..x..x...x..x..', h: 'g.g.g.g.g.g.g.g.' },
      { k: 'x..x....x..x....', r: '..x..x...x..x...', h: 'gggggggggggggggg' },
    ],
    perc: { ganza: ['xgxgxgxgxgxgxgxg'] },
    fill: { drums: { k: 'x..x....x..x....', r: 'x..x..x...x.x.xx', h: 'gggggggggggg....' } },
  },
  {
    id: 'baiao', name: 'Baião / forró', hint: '2/4 · zabumba, triângulo e sanfona', beats: 2, sub: 4, swing: 0.05,
    parts: {
      violao: ['B.TbB.T.', 'B.TbB.TT', 'B..bB.T.'],
      cavaquinho: ['..du..du'],
      ukulele: ['D.dUD.dU'],
      guitarra: ['T..T..T.', '..T...T.'],
      teclado: ['P..TP.T.', '..T...T.'],
      sanfona: ['S..cS.c.', 'S..cS.cc', 'B.cbB.c.'],
      baixo: ['R..5R...', 'R..5R..5', 'R..RR...', 'R..55...'],
    },
    perc: {
      zabumba: ['X..xX...', 'X..xX..g', 'X..xX.x.'],
      triangulo: ['xxXxxxXx', 'xxXxxxXX'],
      ganza: ['x.x.x.x.', 'xxxxxxxx'],
    },
    fill: { perc: { zabumba: 'X..xXxXX', triangulo: 'xxXxxxXX' } },
  },
  {
    id: 'valsa', name: 'Valsa', hint: '3/4 · baixo, dedos, dedos', beats: 3, sub: 1,
    parts: {
      violao: ['BTT', 'B.T', 'bTT'],
      cavaquinho: ['.dd'],
      ukulele: ['Ddd'],
      guitarra: ['D..', 'T.T'],
      teclado: ['PTT', 'P.T'],
      sanfona: ['Bcc', 'bcc', 'S--'],
      baixo: ['R..', '5..', 'R.5'],
    },
    drums: [{ k: 'x..', h: '.xx' }, { k: 'x..', h: '.xx', r: '..x' }],
    fill: { drums: { k: 'x..', s: '.xX' } },
  },
  {
    id: 'dedilhado', name: 'Dedilhado', hint: 'polegar e dedos, uma corda por vez', beats: 4, sub: 2,
    parts: {
      violao: ['B123b321', 'B123b323', 'B1232321', 'B12312b3'],
      cavaquinho: ['....T...', '..T...T.'],
      ukulele: ['.1.2.3.2'],
      guitarra: ['T.......', 'T...T...'],
      teclado: ['B.1.2.3.', 'P.......', 'B..3..2.'],
      sanfona: ['S-------'],
      baixo: ['R...5...', 'R.......', 'R...R...'],
    },
    drums: [
      { k: 'x.......', r: '....x...', h: 'gggggggg' },
      { k: 'x.....x.', r: '....x...', h: 'gggggggg' },
    ],
    fill: { drums: { k: 'x.......', r: '....x.xx' } },
  },
  { id: 'click', name: 'Só metrônomo', hint: 'sem acorde', beats: 4, sub: 1, parts: {} },
];

export const DEFAULT_RHYTHM_ID = 'balada';

export function getRhythm(id: string | null | undefined): Rhythm {
  return RHYTHMS.find((r) => r.id === id) ?? RHYTHMS.find((r) => r.id === DEFAULT_RHYTHM_ID)!;
}

export const beatsPerBar = (r: Rhythm) => r.beats;
export const barLength = (r: Rhythm) => r.beats * r.sub;

// Em desenvolvimento, avisa se alguma levada não tem o tamanho do compasso.
if (process.env.NODE_ENV !== 'production') {
  for (const r of RHYTHMS) {
    const n = barLength(r);
    const lines: [string, string][] = [
      ...Object.entries(r.parts).flatMap(([part, list]) => (list ?? []).map((l) => [part, l] as [string, string])),
      ...Object.entries(r.perc ?? {}).flatMap(([part, list]) => (list ?? []).map((l) => [part, l] as [string, string])),
      ...(r.drums ?? []).flatMap((g) => Object.entries(g).map(([d, l]) => [d, l!] as [string, string])),
      ...Object.entries(r.fill?.drums ?? {}).map(([d, l]) => [`virada ${d}`, l!] as [string, string]),
      ...Object.entries(r.fill?.perc ?? {}).map(([d, l]) => [`virada ${d}`, l!] as [string, string]),
    ];
    for (const [part, line] of lines) {
      if (line.length !== n) console.error(`Ritmo "${r.id}", ${part}: "${line}" tem ${line.length} passos, esperado ${n}.`);
    }
  }
}

/** Batidas (abafam o que soava) x toques de dedilhado (deixam as outras cordas soando). */
const STROKES: Record<string, StrokeOptions> = {
  D: { part: 'all', gain: 1 },
  d: { part: 'all', gain: 0.6 },
  U: { part: 'upper', reverse: true, gain: 0.85 },
  u: { part: 'upper', reverse: true, gain: 0.5 },
  x: { part: 'all', muted: true, gain: 0.9 },
  s: { part: 'upper', short: true, gain: 0.75 },
  B: { part: 'bass', gain: 1, damp: false },
  b: { part: 'altBass', gain: 0.85, damp: false },
  T: { part: 'treble', gain: 0.65, damp: false },
  P: { part: 'pinch', gain: 0.85, damp: false },
  1: { part: 't1', gain: 0.6, damp: false },
  2: { part: 't2', gain: 0.6, damp: false },
  3: { part: 't3', gain: 0.65, damp: false },
};

/** Como tocar o passo (`null` = pausa). */
export function strokeFor(step: string): StrokeOptions | null {
  return STROKES[step] ?? null;
}
