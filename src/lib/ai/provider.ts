/**
 * Camada única de IA: o resto do app pede "gere este JSON" e não sabe qual provedor responde.
 *
 * Escolha do provedor (servidor):
 * - AI_PROVIDER=anthropic | openai, ou
 * - automático: usa o que tiver chave (ANTHROPIC_API_KEY primeiro, depois OPENAI_API_KEY).
 * Modelo: ANTHROPIC_MODEL / OPENAI_MODEL (opcionais).
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AiProvider = 'anthropic' | 'openai';

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export type JsonRequest = {
  system: string;
  user: string;
  /** JSON Schema da resposta (objeto com additionalProperties: false e todos os campos em required). */
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-opus-5-5',
  // Equilíbrio entre qualidade e custo na família GPT-6 (gpt-6.2-astra é o topo, gpt-6.1-terra o econômico).
  openai: 'gpt-6.2-sol',
};

export function activeProvider(): { provider: AiProvider; model: string } | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  const has = { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY };
  const provider: AiProvider | null =
    forced === 'anthropic' || forced === 'openai'
      ? has[forced] ? forced : null
      : has.anthropic ? 'anthropic' : has.openai ? 'openai' : null;
  if (!provider) return null;
  const model = (provider === 'anthropic' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL)?.trim() || DEFAULT_MODELS[provider];
  return { provider, model };
}

export async function generateJson<T>(req: JsonRequest): Promise<{ data: T; provider: AiProvider; model: string }> {
  const active = activeProvider();
  if (!active) throw new AiError('A IA ainda não foi configurada no servidor.', 503);
  const text = active.provider === 'anthropic' ? await callAnthropic(active.model, req) : await callOpenAI(active.model, req);
  try {
    return { data: JSON.parse(text) as T, ...active };
  } catch {
    throw new AiError('A IA devolveu uma resposta em formato inesperado. Tente de novo.');
  }
}

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

async function callAnthropic(model: string, req: JsonRequest): Promise<string> {
  anthropic ??= new Anthropic();
  try {
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: req.maxTokens ?? 16000,
      // Se o modelo recusar por engano (falso positivo de segurança), o próprio servidor tenta outro modelo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: req.schema } },
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    });
    if (response.stop_reason === 'refusal') throw new AiError('A IA recusou este pedido.', 422);
    if (response.stop_reason === 'max_tokens') throw new AiError('A cifra é longa demais para a IA processar de uma vez.', 413);
    return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw providerError(e);
  }
}

async function callOpenAI(model: string, req: JsonRequest): Promise<string> {
  openai ??= new OpenAI();
  try {
    const response = await openai.responses.create({
      model,
      instructions: req.system,
      input: req.user,
      max_output_tokens: req.maxTokens ?? 16000,
      text: { format: { type: 'json_schema', name: req.schemaName, schema: req.schema, strict: true } },
    });
    const refused = response.output.some(
      (item) => item.type === 'message' && item.content.some((c) => c.type === 'refusal'),
    );
    if (refused) throw new AiError('A IA recusou este pedido.', 422);
    if (response.incomplete_details?.reason === 'max_output_tokens') {
      throw new AiError('A cifra é longa demais para a IA processar de uma vez.', 413);
    }
    return response.output_text ?? '';
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw providerError(e);
  }
}

/** Erros dos SDKs viram mensagens para o usuário (o detalhe fica no log do servidor). */
function providerError(e: unknown): AiError {
  console.error('AI provider error:', e);
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403) return new AiError('A chave da IA no servidor é inválida.', 503);
  if (status === 429) return new AiError('A IA está ocupada ou sem créditos no momento. Tente daqui a pouco.', 503);
  if (status && status >= 500) return new AiError('O serviço de IA está instável. Tente de novo.', 502);
  return new AiError('Não foi possível falar com a IA. Tente de novo.', 502);
}
