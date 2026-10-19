// Realize AI através da edge function ai-chat (a chave do modelo fica no servidor; aqui só
// vai o JWT de quem está autenticado) e das tabelas de preferências do próprio.
import { supabase } from '@/integrations/supabase/client';

export type ProposalTool = 'event' | 'task' | 'reminder';

/** Algo que o assistente preparou e a pessoa ainda tem de confirmar. */
export interface AiProposal {
  id: string;
  tool: ProposalTool;
  title: string;
  lines: string[];
  args: Record<string, unknown>;
  status: 'pending' | 'saving' | 'done' | 'cancelled' | 'error';
  /** Resultado depois de confirmar (ou o erro). */
  note?: string;
  link?: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  proposals?: AiProposal[];
}

export interface AiSuggestion {
  kind: string;
  text: string;
  link: string;
}

/** Erro com mensagem já pronta para mostrar ao colaborador. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

const GENERIC = 'O assistente não está disponível neste momento.';

const callFunction = async <T>(payload: unknown, signal?: AbortSignal): Promise<T> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('A sessão terminou. Entre outra vez.', 'unauthorized');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AiError(GENERIC, 'network');
  });

  const body = (await response.json().catch(() => null)) as
    ({ ok?: boolean; code?: string; message?: string } & Record<string, unknown>) | null;
  if (!body || body.ok === false || !response.ok)
    throw new AiError(body?.message ?? GENERIC, body?.code ?? 'error');
  return body as T;
};

/** Pergunta ao assistente: a resposta e o que ele preparou para confirmar. */
export const chat = async (
  messages: Pick<AiMessage, 'role' | 'content'>[],
  signal?: AbortSignal
): Promise<{ reply: string; proposals: Omit<AiProposal, 'status'>[] }> => {
  const body = await callFunction<{ reply: string; proposals: Omit<AiProposal, 'status'>[] }>(
    { action: 'chat', messages },
    signal
  );
  return { reply: body.reply ?? '', proposals: body.proposals ?? [] };
};

/** Grava o que a pessoa confirmou. */
export const executeProposal = (proposal: Pick<AiProposal, 'tool' | 'args'>) =>
  callFunction<{ message: string; link?: string }>({
    action: 'execute',
    tool: proposal.tool,
    args: proposal.args,
  });

export const getDigestEnabled = async (userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('ai_preferences')
    .select('daily_digest')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.daily_digest ?? false;
};

/** Liga ou desliga o resumo diário; lança erro se não gravar (o interruptor volta atrás). */
export const setDigestEnabled = async (userId: string, enabled: boolean): Promise<void> => {
  const { error } = await supabase
    .from('ai_preferences')
    .upsert({ user_id: userId, daily_digest: enabled }, { onConflict: 'user_id' });
  if (error) throw error;
};

export const getSuggestions = async (): Promise<AiSuggestion[]> => {
  const { data, error } = await supabase.rpc('ai_suggestions');
  if (error || !Array.isArray(data)) return [];
  return data as unknown as AiSuggestion[];
};
