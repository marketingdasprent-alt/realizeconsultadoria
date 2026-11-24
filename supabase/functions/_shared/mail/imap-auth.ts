/** Recusas temporárias de login não significam que a palavra-passe deixou de ser válida. */
export const isImapAuthFailure = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as {
    authenticationFailed?: unknown;
    responseText?: unknown;
    responseCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const text = [e.responseText, e.responseCode, e.code, e.message]
    .map(v => String(v ?? ''))
    .join(' ');
  // Alguns servidores recusam AUTH com NO [UNAVAILABLE] e o cliente assinala
  // authenticationFailed mesmo quando a resposta pede apenas para tentar mais tarde.
  if (
    /\b(?:UNAVAILABLE|TRYLATER|INUSE|LIMIT|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ESOCKET)\b|temporar|try (?:again )?later|too many|rate.?limit|timed? ?out|timeout|connection (?:closed|reset)|unexpected close/i.test(
      text
    )
  )
    return false;
  return (
    e.authenticationFailed === true ||
    /AUTHENTICATIONFAILED|invalid credentials|authentication failed|LOGIN failed/i.test(text)
  );
};

/** Uma tentativa lenta de recuperação por conta, partilhada entre todas as instâncias. */
export const IMAP_REAUTH_GAP_MS = 30 * 60_000;

export const isImapRecovery = (account: { auth_method: string; status: string }): boolean =>
  account.auth_method === 'imap' && account.status === 'reauth';
