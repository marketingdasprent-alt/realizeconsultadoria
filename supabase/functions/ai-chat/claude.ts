// Realize AI com o Claude (Anthropic) primeiro. O resto da função fala o formato OpenAI do
// servidor próprio (ia.dasprent.pt); aqui converte-se para a Messages API e de volta, para que o
// ciclo de ferramentas e o "Usar IA" não mudem.
//
// Segredos: ANTHROPIC_API_KEY (sem ela, o Claude fica desligado e tudo vai para o servidor
// próprio, como antes) e ANTHROPIC_MODEL (opcional; por omissão claude-sonnet-5-5).
// Se o Claude falhar (sem chave válida, sem créditos, limite, em baixo, sem rede) quem chama usa o
// servidor próprio. Uma recusa por segurança NÃO segue para lá: devolve-se a recusa.

import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';

type ModelMessage = Record<string, unknown>;
interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** O Claude recusou por segurança: não se tenta o servidor próprio. */
export class ClaudeRefusal extends Error {}

export const CLAUDE_REFUSAL_TEXT =
  'Não posso ajudar com esse pedido. Se achar que é engano, reformule a pergunta.';

const apiKey = () => Deno.env.get('ANTHROPIC_API_KEY')?.trim() || null;
export const claudeEnabled = () => !!apiKey();
export const claudeModel = () => Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-5-5';

let client: Anthropic | null = null;
const getClient = () => {
  // Uma tentativa extra no máximo: se falhar, o servidor próprio responde.
  client ??= new Anthropic({ apiKey: apiKey() ?? undefined, maxRetries: 1 });
  return client;
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Mensagens no formato OpenAI → system + messages da Messages API. */
const toAnthropic = (messages: ModelMessage[]) => {
  const system: string[] = [];
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      system.push(text(message.content));
    } else if (message.role === 'user') {
      out.push({ role: 'user', content: text(message.content) || ' ' });
    } else if (message.role === 'assistant') {
      // Resposta que veio do Claude: volta tal e qual (com os blocos de pensamento).
      const raw = message._claude as Anthropic.Beta.BetaContentBlockParam[] | undefined;
      if (raw?.length) out.push({ role: 'assistant', content: raw });
      else {
        const calls = Array.isArray(message.tool_calls)
          ? (message.tool_calls as {
              id?: string;
              function?: { name?: string; arguments?: unknown };
            }[])
          : [];
        const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
        if (text(message.content)) blocks.push({ type: 'text', text: text(message.content) });
        for (const call of calls) {
          let input: unknown = call.function?.arguments ?? {};
          if (typeof input === 'string') {
            try {
              input = JSON.parse(input);
            } catch {
              input = {};
            }
          }
          blocks.push({
            type: 'tool_use',
            id: call.id ?? crypto.randomUUID(),
            name: call.function?.name ?? '',
            input: (input ?? {}) as Record<string, unknown>,
          });
        }
        out.push({ role: 'assistant', content: blocks.length ? blocks : ' ' });
      }
    } else if (message.role === 'tool') {
      // Os resultados das ferramentas vão todos na mesma mensagem do utilizador.
      const block: Anthropic.Beta.BetaToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: text(message.tool_call_id),
        content: text(message.content) || 'ok',
      };
      const last = out[out.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content)) last.content.push(block);
      else out.push({ role: 'user', content: [block] });
    }
  }
  return { system: system.filter(Boolean).join('\n\n'), messages: out };
};

/**
 * Uma volta com o Claude. Devolve a mensagem no formato OpenAI (content + tool_calls), com o
 * conteúdo original em `_claude` para a volta seguinte. Lança ClaudeRefusal se recusar.
 */
export const callClaude = async (
  messages: ModelMessage[],
  tools: ToolDef[] | null,
  maxTokens: number,
  timeoutMs: number
): Promise<ModelMessage> => {
  const { system, messages: converted } = toAnthropic(messages);
  const params = {
    model: claudeModel(),
    // O pensamento adaptativo também conta: margem acima do que o servidor próprio usa.
    max_tokens: Math.max(4000, maxTokens * 2),
    // Conversa e reescrita: rápido e barato; com ferramentas, um pouco mais de cuidado.
    output_config: { effort: tools ? 'medium' : 'low' },
    system,
    messages: converted,
    ...(tools
      ? {
          tools: tools.map(def => ({
            name: def.name,
            description: def.description,
            input_schema: def.parameters as Anthropic.Beta.BetaTool.InputSchema,
          })),
        }
      : {}),
    // Recusa num modelo: a Anthropic tenta outro modelo Claude antes de desistir.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;

  const response = await getClient().beta.messages.create(params, { timeout: timeoutMs });
  if (response.stop_reason === 'refusal') throw new ClaudeRefusal(CLAUDE_REFUSAL_TEXT);

  const reply = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
  const calls = response.content
    .filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use')
    .map(block => ({
      id: block.id,
      type: 'function',
      function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
    }));
  return {
    role: 'assistant',
    content: reply,
    ...(calls.length ? { tool_calls: calls } : {}),
    _claude: response.content,
  };
};
