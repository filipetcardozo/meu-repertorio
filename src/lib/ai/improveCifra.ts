/**
 * "Melhorar cifra": a IA alinha acordes, marca as seções, padroniza a escrita e limpa espaços,
 * sem mudar a letra nem os acordes. O código confere o resultado; se a IA errar, tenta mais uma vez
 * explicando o erro, e se errar de novo a sugestão é descartada.
 */
import { AiError, generateJson, type AiProvider } from './provider';
import { checkImprovedCifra, cifraHtmlToText, cifraTextToHtml } from './cifraText';

export const CHANGE_TYPES = ['alinhamento', 'secao', 'notacao', 'espacamento', 'outro'] as const;
export type CifraChange = { tipo: (typeof CHANGE_TYPES)[number]; descricao: string };

export type ImproveCifraInput = {
  lyric: string;
  lyricName?: string;
  composerName?: string;
  originalTone?: string;
};

export type ImproveCifraResult = {
  lyric: string;
  tone: string;
  changes: CifraChange[];
  provider: AiProvider;
  model: string;
};

/** Tamanho máximo da cifra em texto (uma música longa com tablaturas fica bem abaixo disso). */
export const MAX_CIFRA_CHARS = 30000;

const SCHEMA = {
  type: 'object',
  properties: {
    tom: { type: 'string', description: 'Tom da música, ex.: "G", "Em", "Bb". Vazio se não der para saber.' },
    mudancas: {
      type: 'array',
      description: 'O que foi mudado, em português do Brasil. Vazio se a cifra já estava boa.',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: [...CHANGE_TYPES] },
          descricao: { type: 'string' },
        },
        required: ['tipo', 'descricao'],
        additionalProperties: false,
      },
    },
    cifra: { type: 'string', description: 'A cifra completa melhorada, em texto puro.' },
  },
  required: ['tom', 'mudancas', 'cifra'],
  additionalProperties: false,
};

const SYSTEM = `Você revisa cifras de músicas (letra com acordes) para músicos que tocam ao vivo. A cifra vem em texto puro, fonte monoespaçada: cada linha de acordes fica logo acima da linha da letra, e a coluna de cada acorde indica a sílaba em que ele entra.

Seu trabalho é deixar a cifra limpa e fácil de ler no palco, sem mudar a música:

1. Alinhamento: posicione cada acorde exatamente sobre a sílaba em que ele entra. Corrija acordes deslocados, mas só quando estiver claro pelo contexto (sílaba tônica, início de palavra, padrão das outras estrofes). Na dúvida, deixe onde está.
2. Seções: marque as partes da música em linhas próprias, no formato [Intro], [Primeira Parte], [Segunda Parte], [Pré-Refrão], [Refrão], [Ponte], [Solo], [Final]. Mantenha os títulos que já existem, só padronizando o formato. Acordes que vêm na mesma linha do título continuam nela, depois do título.
3. Notação: use uma grafia consistente para o mesmo acorde em toda a cifra. Escolha sustenido ou bemol de acordo com o tom (ex.: Bb em Fá maior, A# em Fá# maior). Pode trocar só a grafia, nunca o acorde: A# e Bb são o mesmo acorde; Am e A não são.
4. Espaçamento: no máximo uma linha em branco entre blocos, sem espaços sobrando no fim das linhas.

Regras que não podem ser quebradas:
- A letra fica idêntica, palavra por palavra e na mesma ordem. Não corrija ortografia, não traduza, não junte nem resuma repetições.
- A sequência de acordes fica idêntica: não acrescente, não remova e não troque acordes, nem mesmo os que parecerem errados. Só mude a posição na linha e a grafia.
- Os marcadores ⟦TAB 1⟧, ⟦TAB 2⟧... representam tablaturas: copie cada um exatamente, uma vez, na mesma ordem e em linha própria.
- Devolva a cifra inteira, não só os trechos alterados.

Em "mudancas", liste o que mudou de forma curta e concreta (ex.: "Refrão: G movido para 'lugar'", "Marcadas as seções Intro, Refrão e Ponte"). Agrupe mudanças parecidas. Se a cifra já estava boa, devolva-a como veio e deixe a lista vazia.`;

function userMessage(input: ImproveCifraInput, text: string, retryReason?: string) {
  const meta = [
    input.lyricName && `Música: ${input.lyricName}`,
    input.composerName && `Artista: ${input.composerName}`,
    input.originalTone && `Tom cadastrado: ${input.originalTone}`,
  ].filter(Boolean).join('\n');
  const retry = retryReason
    ? `\n\nAtenção: a tentativa anterior foi descartada pela conferência automática: ${retryReason} Refaça a partir da cifra original abaixo respeitando as regras.`
    : '';
  return `${meta}${retry}\n\n<cifra>\n${text}\n</cifra>`;
}

type RawResult = { tom: string; mudancas: CifraChange[]; cifra: string };

export async function improveCifra(input: ImproveCifraInput): Promise<ImproveCifraResult> {
  const original = cifraHtmlToText(input.lyric);
  if (!original.text.trim()) throw new AiError('Esta música não tem cifra para melhorar.', 400);
  if (original.text.length > MAX_CIFRA_CHARS) throw new AiError('A cifra é longa demais para a IA.', 413);

  let reason: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, provider, model } = await generateJson<RawResult>({
      system: SYSTEM,
      user: userMessage(input, original.text, reason),
      schema: SCHEMA,
      schemaName: 'cifra_melhorada',
    });
    const text = (data.cifra ?? '').replace(/^\n+|\s+$/g, '');
    const html = cifraTextToHtml(text, original.tabs, original.chords);
    const check = checkImprovedCifra(original, input.lyric, text, html);
    if (check.ok) {
      const changes = (data.mudancas ?? []).filter((c) => c?.descricao?.trim());
      return {
        lyric: html,
        tone: /^[A-G][#b]?m?$/.test(data.tom?.trim() ?? '') ? data.tom.trim() : '',
        changes,
        provider,
        model,
      };
    }
    reason = check.reason;
    console.warn('improveCifra: tentativa descartada:', reason);
  }
  throw new AiError('A IA não conseguiu melhorar esta cifra sem alterar a letra ou os acordes. Nada foi mudado.', 422);
}
