// Erro de negócio do Webmail: vira { ok: false, code, message } na resposta (HTTP 200).

export type MailErrorCode =
  | 'not_found'
  | 'message_not_found'
  | 'reauth'
  | 'provider_error'
  | 'rate_limited'
  | 'imap_login_failed'
  | 'smtp_port_blocked'
  | 'smtp_failed'
  | 'too_large'
  | 'invalid_recipient'
  | 'not_supported'
  | 'bad_request';

export class MailError extends Error {
  readonly code: MailErrorCode;

  constructor(code: MailErrorCode, message: string) {
    super(message);
    this.name = 'MailError';
    this.code = code;
  }
}

export const isMailError = (error: unknown): error is MailError => error instanceof MailError;

/** Mensagens por omissão (pt-PT) para mostrar ao colaborador. */
export const MAIL_ERROR_MESSAGES: Record<MailErrorCode, string> = {
  not_found: 'Conta de email não encontrada.',
  message_not_found: 'A mensagem já não existe nesta caixa.',
  reauth: 'A ligação à conta expirou. Volte a ligar a conta.',
  provider_error: 'O fornecedor de email não respondeu como esperado. Tente novamente.',
  rate_limited: 'Demasiados pedidos ao fornecedor de email. Aguarde um pouco.',
  imap_login_failed:
    'Não foi possível entrar na caixa IMAP. Confirme o servidor e a palavra-passe.',
  smtp_port_blocked:
    'O envio só funciona pela porta SMTP 465 (SSL/TLS); as portas 25 e 587 estão bloqueadas no servidor.',
  smtp_failed: 'O servidor SMTP recusou o envio.',
  too_large: 'A mensagem ultrapassa o limite de 10 MB.',
  invalid_recipient: 'Há destinatários com endereço inválido.',
  not_supported: 'Operação não suportada nesta caixa.',
  bad_request: 'Pedido inválido.',
};

export const mailError = (code: MailErrorCode, message?: string): MailError =>
  new MailError(code, message ?? MAIL_ERROR_MESSAGES[code]);
