// Edge function ai-chat: o "Realize AI". Conversa com o modelo da empresa e, quando pedem,
// prepara eventos, tarefas e lembretes (que a pessoa confirma no ecrã antes de gravar).
//
// POST com Authorization: Bearer <JWT do utilizador>. Respostas de negócio em HTTP 200:
//   { action: 'chat', messages: [{ role: 'user' | 'assistant', content }] }
//        → { ok: true, reply, proposals: [{ id, tool, title, lines, args }] }
//   { action: 'execute', tool: 'event' | 'task' | 'reminder', args }
//        → { ok, message, link? }          (grava uma proposta confirmada)
//   { action: 'rewrite', text, mode: 'complete' | 'formal' | 'short' | 'fix', subject?, context? }
//        → { ok: true, text, subject }     ("Usar IA" no Webmail: reescreve o email e o assunto)
//   erros: { ok: false, code, message }
//
// O modelo é qualquer servidor compatível com a API da OpenAI (Ollama, OpenAI, DeepSeek, ...).
// Segredos da função (nunca vão para o browser):
//   AI_BASE_URL   ex.: https://ia.dasprent.pt/v1
//   AI_MODEL      ex.: qwen2.5:7b
//   AI_API_KEY    a chave do servidor (ou OLLAMA_API_KEY; opcional se o servidor não a exigir)
//   AI_TOOLS_MODEL (opcional) modelo para este assistente, se for outro que o de AI_MODEL
//   AI_WRITE_MODEL (opcional) modelo para reescrever emails (por omissão, o das ferramentas)
// verify_jwt = false: o JWT é validado aqui (auth.getUser).

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { describeInstant, fold } from '../_shared/ai/time.ts';
import {
  parseRewrite,
  MAX_REWRITE_CONTEXT,
  MAX_REWRITE_TEXT,
  REWRITE_MODES,
  rewritePrompt,
  rewriteUserMessage,
  type RewriteMode,
} from '../_shared/ai/rewrite.ts';
import type { Person } from '../_shared/ai/time.ts';
import {
  authenticatedUserId,
  corsHeaders,
  fetchWithTimeout,
  json,
  serviceClient,
} from '../_shared/mail-server/http.ts';
import {
  callClaude,
  claudeEnabled,
  ClaudeRefusal,
  CLAUDE_REFUSAL_TEXT,
  claudeModel,
} from './claude.ts';
import {
  executeProposal,
  personalContext,
  runTool,
  TOOL_DEFS,
  type Proposal,
  type ToolContext,
} from './tools.ts';

const MAX_MESSAGES = 30;
const MAX_CONTENT = 8000;
const PER_MINUTE = 12;
const PER_DAY = 300;
const MAX_ROUNDS = 4;
/**
 * Tempo total para responder. A função é cortada aos 150 s; acima disto devolve-se o que houver
 * (ou um aviso), em vez de a pessoa ficar sem resposta nenhuma.
 */
const TIME_BUDGET_MS = 115_000;
const SLOW = 'A IA está a demorar demasiado neste momento. Tente outra vez daqui a pouco.';

// Só pedidos para FAZER algo (marcar, criar, lembrar, convidar) usam o modelo das ferramentas,
// mais capaz mas lento no CPU. Perguntas ("quantos dias de férias tenho?", "o que tenho
// amanhã?") vão para o modelo rápido, com os dados da pessoa já incluídos.
// "Agenda" sozinha ("o que tenho na agenda?") é a agenda, não o verbo: vai para o modelo rápido.
const ACTION_HINT =
  /\b(marca|marcar|marque|agendar|agende|agenda (uma?|reuniao|evento|chamada)|desmarca|lembra|lembrar|lembre|lembrete|convida|convidar|convide|cria|criar|crie|adiciona|adicionar|nova reuniao|nova tarefa)\b/;

type Role = 'user' | 'assistant';
interface ChatMessage {
  role: Role;
  content: string;
}
type ModelMessage = Record<string, unknown>;

const fail = (code: string, message: string) => json({ ok: false, code, message });
const UNAVAILABLE = 'O assistente não está disponível neste momento.';

const parseMessages = (value: unknown): ChatMessage[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { role, content } = item as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const text = content.trim();
    if (text.length > MAX_CONTENT) return null;
    // Respostas vazias de tentativas falhadas ficam de fora do histórico.
    if (text) messages.push({ role, content: text });
  }
  return messages.length && messages[messages.length - 1].role === 'user' ? messages : null;
};

const systemPrompt = (firstName: string, now: Date, withTools: boolean, context: string) =>
  `És o Realize AI, o assistente dos colaboradores da Realize Consultadoria. ` +
  `Estás a falar com ${firstName}. Agora é ${describeInstant(now)} (hora de Lisboa). ` +
  `Dados atuais desta pessoa (usa-os para responder; não precisas de os ir buscar):\n${context}\n` +
  `Responde sempre em português de Portugal, de forma clara e muito concisa: no máximo três ou quatro frases, ou uma lista curta, a não ser que peçam mais detalhe. ` +
  (withTools
    ? `Tens ferramentas: lê a agenda, as tarefas e o saldo de férias da pessoa, procura colegas, e prepara eventos, tarefas e lembretes. ` +
      `Para marcar, criar ou lembrar algo usa SEMPRE propose_event, propose_task ou propose_reminder: elas só preparam uma proposta e a pessoa confirma num cartão. ` +
      `Depois de preparar, diz numa frase o que preparaste e que basta confirmar no cartão; nunca digas que já ficou criado. ` +
      `Calcula datas relativas (amanhã, sexta, daqui a duas semanas) a partir de agora. Se faltar a data ou a hora, pergunta antes. ` +
      `Se uma ferramenta pedir esclarecimento (nome repetido, data passada), pergunta à pessoa. `
    : `Se a pessoa quiser marcar, criar ou lembrar algo, diz-lhe para pedir diretamente (por exemplo "marca uma reunião amanhã às 10h"). `) +
  `Não inventes factos nem dados da empresa; se não souberes, di-lo.`;

/** Uma chamada ao modelo (sem fluxo: as ferramentas precisam da resposta inteira). */
const callModel = async (
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
  messages: ModelMessage[],
  withTools: boolean,
  timeoutMs = 90_000,
  maxTokens = 700,
  useClaude = true
): Promise<{ message?: ModelMessage; status: number }> => {
  // Primeiro o Claude (se houver chave). Falhou: segue para o servidor próprio, abaixo.
  // Recusa por segurança: responde-se com a recusa, sem tentar o servidor próprio.
  if (useClaude && claudeEnabled()) {
    try {
      const message = await callClaude(
        messages,
        withTools ? TOOL_DEFS : null,
        maxTokens,
        Math.min(timeoutMs, 60_000)
      );
      return { message, status: 200 };
    } catch (error) {
      if (error instanceof ClaudeRefusal)
        return { message: { role: 'assistant', content: CLAUDE_REFUSAL_TEXT }, status: 200 };
      console.error(
        'ai-chat: Claude indisponível, a usar o servidor próprio:',
        error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : String(error)
      );
    }
  }
  const response = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: maxTokens,
        temperature: 0.3,
        // Sem o conteúdo original do Claude (campo só nosso, o servidor próprio não o conhece).
        messages: messages.map(({ _claude: _ignored, ...rest }) => rest),
        ...(withTools
          ? { tools: TOOL_DEFS.map(def => ({ type: 'function', function: def })) }
          : {}),
      }),
    },
    timeoutMs
  );
  if (!response.ok) {
    console.error(
      'ai-chat: o modelo respondeu',
      response.status,
      (await response.text()).slice(0, 200)
    );
    return { status: response.status };
  }
  const body = (await response.json()) as { choices?: { message?: ModelMessage }[] };
  return { message: body.choices?.[0]?.message, status: 200 };
};

/**
 * Verificação interna: o modelo da conversa e o das ferramentas respondem, e em quanto tempo?
 * Só com o token do sistema (a base de dados chama-a por pg_net); não devolve segredos.
 */
const healthCheck = async (baseUrl: string, chatModel: string, toolsModel: string) => {
  const apiKey = (Deno.env.get('AI_API_KEY') ?? Deno.env.get('OLLAMA_API_KEY'))?.trim();
  // useClaude: mede o Claude; sem ele, o servidor próprio (a reserva).
  const probe = async (model: string, withTools: boolean, useClaude = false) => {
    const started = Date.now();
    try {
      const { message, status } = await callModel(
        baseUrl,
        model,
        apiKey,
        [
          { role: 'system', content: 'Responde em português de Portugal, numa frase.' },
          { role: 'user', content: withTools ? 'O que tenho na agenda esta semana?' : 'Diz olá.' },
        ],
        withTools,
        90_000,
        700,
        useClaude
      );
      return {
        model,
        withTools,
        status,
        ms: Date.now() - started,
        toolCalls: Array.isArray(message?.tool_calls) ? message.tool_calls.length : 0,
        reply: typeof message?.content === 'string' ? message.content.slice(0, 80) : null,
      };
    } catch (error) {
      return {
        model,
        withTools,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
  return {
    ok: true,
    probes: await Promise.all([
      ...(claudeEnabled()
        ? [
            probe(`claude:${claudeModel()}`, false, true),
            probe(`claude:${claudeModel()}`, true, true),
          ]
        : []),
      probe(chatModel, false),
      probe(toolsModel, true),
    ]),
  };
};

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'bad_request' }, 405);

  const baseUrl = Deno.env.get('AI_BASE_URL')?.replace(/\/+$/, '');
  const chatModel = Deno.env.get('AI_MODEL');
  const toolsModel = Deno.env.get('AI_TOOLS_MODEL') || chatModel;
  if (!baseUrl || !chatModel || !toolsModel)
    return fail('not_configured', 'A IA ainda não está configurada.');

  if (req.headers.get('x-system-token')) {
    const systemToken = Deno.env.get('MAIL_SYSTEM_TOKEN');
    if (!systemToken || req.headers.get('x-system-token') !== systemToken)
      return json({ ok: false }, 401);
    // { probe: 'rewrite' }: mede o "Usar IA" (modelo de escrita) e mostra o início da resposta.
    const probe = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (probe.probe === 'rewrite') {
      const apiKey = (Deno.env.get('AI_API_KEY') ?? Deno.env.get('OLLAMA_API_KEY'))?.trim();
      const writeModel = Deno.env.get('AI_WRITE_MODEL') || toolsModel;
      const started = Date.now();
      try {
        const { message, status } = await callModel(
          baseUrl,
          writeModel,
          apiKey,
          [
            { role: 'system', content: rewritePrompt('complete', 'Teste') },
            {
              role: 'user',
              content: rewriteUserMessage(
                String(probe.text ?? 'ola'),
                String(probe.subject ?? ''),
                ''
              ),
            },
          ],
          false,
          TIME_BUDGET_MS,
          1500
        );
        const raw = typeof message?.content === 'string' ? message.content : null;
        return json({
          ok: true,
          model: writeModel,
          status,
          ms: Date.now() - started,
          raw: raw?.slice(0, 400) ?? null,
          parsed: raw ? parseRewrite(raw) : null,
        });
      } catch (error) {
        return json({
          ok: false,
          model: writeModel,
          ms: Date.now() - started,
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
      }
    }
    return json(await healthCheck(baseUrl, chatModel, toolsModel));
  }

  const admin = serviceClient();
  const userId = await authenticatedUserId(req, admin);
  if (!userId) return json({ ok: false, code: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }

  const { data: found } = await admin
    .from('employees')
    .select('name, company_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  let employee: { name: string; company_id: string | null } | null = found;
  // Admins sem ficha de colaborador também podem usar o "Usar IA" (email e comunicados);
  // o assistente com dados pessoais continua só para colaboradores.
  if (!employee && body.action === 'rewrite') {
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: linked } = await admin
      .from('employees')
      .select('name')
      .eq('admin_user_id', userId)
      .limit(1)
      .maybeSingle();
    if (isAdmin && linked) employee = { name: linked.name, company_id: null };
    else if (isAdmin) {
      const { data: profile } = await admin
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .maybeSingle();
      const { data: auth } = await admin.auth.admin.getUserById(userId);
      const fallback = String(auth.user?.user_metadata?.name ?? auth.user?.email ?? 'a equipa');
      employee = { name: profile?.name || fallback.split('@')[0], company_id: null };
    }
  }
  if (!employee) return json({ ok: false, code: 'forbidden' }, 403);

  // Cliente com o JWT da pessoa: as regras de acesso da base de dados aplicam-se.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let people: Person[] | null = null;
  const ctx: ToolContext = {
    db,
    userId,
    // Sem empresa só os admins do "Usar IA", que não chegam às ferramentas.
    companyId: employee.company_id ?? '',
    now: new Date(),
    directory: async () => {
      if (!people) {
        const { data } = await db.rpc('chat_directory');
        people = (data ?? []) as Person[];
      }
      return people;
    },
  };

  if (body.action === 'execute') {
    const args =
      body.args && typeof body.args === 'object' ? (body.args as Record<string, unknown>) : {};
    const result = await executeProposal(ctx, String(body.tool ?? ''), args);
    return json(result);
  }

  const rewrite = body.action === 'rewrite';
  const history = rewrite ? null : parseMessages(body.messages);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const mode = (REWRITE_MODES as readonly unknown[]).includes(body.mode)
    ? (body.mode as RewriteMode)
    : 'complete';
  if (rewrite ? !text || text.length > MAX_REWRITE_TEXT : !history)
    return json({ ok: false, code: 'bad_request' }, 400);

  // Limite de pedidos por pessoa (o modelo é nosso e partilhado).
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [perMinute, perDay] = await Promise.all([
    admin
      .from('ai_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', minuteAgo),
    admin
      .from('ai_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayAgo),
  ]);
  if ((perMinute.count ?? 0) >= PER_MINUTE)
    return fail('rate_limited', 'Muitos pedidos seguidos. Espere um minuto e tente outra vez.');
  if ((perDay.count ?? 0) >= PER_DAY)
    return fail('rate_limited', 'Chegou ao limite de pedidos de hoje. Volte amanhã.');
  await admin.from('ai_requests').insert({ user_id: userId });

  // Sem espaços nem quebras de linha à volta (vêm da área de transferência).
  const apiKey = (Deno.env.get('AI_API_KEY') ?? Deno.env.get('OLLAMA_API_KEY'))?.trim();

  if (rewrite) {
    const writeModel = Deno.env.get('AI_WRITE_MODEL') || toolsModel;
    const subject = typeof body.subject === 'string' ? body.subject.slice(0, 300) : '';
    const context =
      typeof body.context === 'string' ? body.context.trim().slice(0, MAX_REWRITE_CONTEXT) : '';
    const deadline = Date.now() + TIME_BUDGET_MS;
    try {
      // O servidor da IA às vezes falha quando está a carregar o modelo: tenta-se outra vez.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remaining = deadline - Date.now();
        if (remaining < 20_000) break;
        const { message, status } = await callModel(
          baseUrl,
          writeModel,
          apiKey,
          [
            { role: 'system', content: rewritePrompt(mode, employee.name.split(' ')[0]) },
            { role: 'user', content: rewriteUserMessage(text, subject, context) },
          ],
          false,
          remaining,
          1500
        );
        if (status === 401 || status === 403)
          return fail('not_configured', 'A chave da IA não é válida. Fale com a administração.');
        const result = parseRewrite(typeof message?.content === 'string' ? message.content : '');
        if (result.text) return json({ ok: true, text: result.text, subject: result.subject });
        console.error('ai-chat: reescrever sem texto', status, 'tentativa', attempt + 1);
      }
      return fail('unavailable', UNAVAILABLE);
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      console.error('ai-chat: reescrever falhou', timedOut ? 'tempo esgotado' : error);
      return fail('unavailable', timedOut ? SLOW : UNAVAILABLE);
    }
  }
  if (!history) return json({ ok: false, code: 'bad_request' }, 400);

  const lastUser = history[history.length - 1].content;
  const withTools = ACTION_HINT.test(fold(lastUser));
  const model = withTools ? toolsModel : chatModel;
  const messages: ModelMessage[] = [
    {
      role: 'system',
      content: systemPrompt(
        employee.name.split(' ')[0],
        ctx.now,
        withTools,
        await personalContext(ctx)
      ),
    },
    ...history,
  ];
  const proposals: Proposal[] = [];
  const deadline = Date.now() + TIME_BUDGET_MS;
  let reply = '';

  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const remaining = deadline - Date.now();
      if (remaining < 5_000) break;
      const { message, status } = await callModel(
        baseUrl,
        model,
        apiKey,
        messages,
        withTools,
        Math.min(90_000, remaining)
      );
      if (status === 401 || status === 403)
        return fail('not_configured', 'A chave da IA não é válida. Fale com a administração.');
      if (status === 404)
        return fail('unavailable', 'O modelo da IA não foi encontrado no servidor.');
      if (!message) return fail('unavailable', UNAVAILABLE);

      const calls = Array.isArray(message.tool_calls)
        ? (message.tool_calls as {
            id?: string;
            function?: { name?: string; arguments?: unknown };
          }[])
        : [];
      if (!calls.length) {
        reply = typeof message.content === 'string' ? message.content.trim() : '';
        break;
      }
      // Com o conteúdo original do Claude, se veio dele (a volta seguinte precisa dele).
      messages.push({
        ...message,
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: calls,
      });
      for (const call of calls.slice(0, 4)) {
        const result = await runTool(
          ctx,
          call.function?.name ?? '',
          parseArgs(call.function?.arguments)
        );
        if (result.proposal) proposals.push(result.proposal);
        messages.push({
          role: 'tool',
          tool_call_id: call.id ?? call.function?.name,
          content: result.content,
        });
      }
    }
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    console.error('ai-chat: sem resposta do modelo', timedOut ? 'tempo esgotado' : error);
    // Se já havia algo preparado, mostra-se; senão, diz-se porquê.
    if (!proposals.length) return fail('unavailable', timedOut ? SLOW : UNAVAILABLE);
  }
  if (!reply && !proposals.length && Date.now() >= deadline - 5_000)
    return fail('unavailable', SLOW);

  if (!reply)
    reply = proposals.length
      ? 'Preparei isto para si. Confirme abaixo.'
      : 'Não consegui responder a isso. Pode reformular o pedido?';
  return json({ ok: true, reply, proposals });
});
