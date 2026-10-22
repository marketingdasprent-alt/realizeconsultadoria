// Um reconhecimento é sério: tem de dizer que trabalho foi reconhecido e tem limites diários.
// Os mesmos limites são impostos na BD (trigger appreciations_before_insert).
export const APPRECIATION_MIN_MESSAGE = 30;
export const APPRECIATION_MAX_MESSAGE = 500;
export const APPRECIATION_DAILY_LIMIT = 3;

/** Quantos caracteres faltam para o motivo ser válido (0 = ok). */
export const messageShortfall = (message: string): number =>
  Math.max(0, APPRECIATION_MIN_MESSAGE - message.trim().length);

/** Texto para o erro devolvido pela BD (limites diários). */
export const appreciationErrorText = (error: unknown): string => {
  const message =
    error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
  if (message.includes('appreciation_daily_limit'))
    return `Só pode enviar ${APPRECIATION_DAILY_LIMIT} reconhecimentos por dia.`;
  if (message.includes('appreciation_recipient_limit'))
    return 'Já reconheceu esta pessoa nas últimas 24 horas.';
  if (message.includes('appreciation_reason_required'))
    return 'Explique o trabalho reconhecido (motivo obrigatório).';
  return 'A apreciação não foi enviada.';
};
