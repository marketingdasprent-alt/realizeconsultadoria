// Confirmação em dois passos (código de 6 dígitos de uma app de autenticação): regras puras.

export const CODE_LENGTH = 6;

/** O código é só 6 dígitos (espaços de quem copia da app não contam). */
export const cleanCode = (value: string) => value.replace(/\s+/g, '');
export const isValidCode = (value: string) => /^\d{6}$/.test(cleanCode(value));

/** O QR vem como SVG (com ou sem o prefixo de endereço de dados). */
export const qrSource = (qrCode: string) =>
  qrCode.startsWith('data:') ? qrCode : `data:image/svg+xml;utf-8,${qrCode}`;

/** A chave em grupos de 4 (mais fácil de copiar à mão). */
export const groupSecret = (secret: string) =>
  secret
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();

export interface AssuranceLevels {
  currentLevel: string | null;
  nextLevel: string | null;
}

/** A conta tem um segundo passo ativo e esta sessão ainda não o fez. */
export const needsChallenge = (levels: AssuranceLevels | null | undefined) =>
  !!levels && levels.nextLevel === 'aal2' && levels.currentLevel !== 'aal2';

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** Mensagem para a pessoa (nunca o texto técnico do servidor). */
export const mfaErrorMessage = (error: unknown): string => {
  const { code, message, status } = (error ?? {}) as NonNullable<ErrorLike>;
  const text = (message ?? '').toLowerCase();
  if (
    code === 'mfa_verification_failed' ||
    text.includes('invalid totp') ||
    text.includes('invalid code')
  )
    return 'Código inválido. Confirme os 6 dígitos que a app mostra agora e tente outra vez.';
  if (code === 'mfa_challenge_expired' || text.includes('expired'))
    return 'O código expirou. Introduza o código atual da app.';
  if (code === 'over_request_rate_limit' || status === 429 || text.includes('rate limit'))
    return 'Demasiadas tentativas. Espere um minuto e tente outra vez.';
  if (code === 'mfa_totp_enroll_not_enabled' || code === 'mfa_totp_verify_not_enabled')
    return 'A confirmação em dois passos ainda não está disponível. Fale com a equipa da Realize.';
  if (code === 'insufficient_aal') return 'Confirme primeiro com o código da app.';
  if (code === 'mfa_factor_name_conflict')
    return 'Já existe uma configuração por concluir. Tente outra vez.';
  return 'Não foi possível concluir. Verifique a ligação e tente outra vez.';
};

/** O servidor não tem este recurso ligado (para mostrar "indisponível" em vez de um erro). */
export const isMfaUnavailable = (error: unknown) => {
  const { code } = (error ?? {}) as NonNullable<ErrorLike>;
  return code === 'mfa_totp_enroll_not_enabled' || code === 'mfa_totp_verify_not_enabled';
};
