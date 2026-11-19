/**
 * Motivo de uma Edge Function que respondeu com erro (403/404/400…): lê o corpo JSON
 * `{ error }` do `error.context` do supabase-js; sem corpo utilizável devolve `fallback`.
 */
export const functionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  try {
    const body = await (error as { context?: Response } | null)?.context?.json();
    if (typeof body?.error === 'string' && body.error) return body.error;
  } catch {
    /* o corpo não é JSON: fica a mensagem geral */
  }
  return fallback;
};
