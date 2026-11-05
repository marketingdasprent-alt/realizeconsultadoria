// Antes de enviar: o que falta no email (sem destinatário não se envia; o resto pergunta-se).

export interface SendCheck {
  /** Sem ninguém em Para, Cc ou Bcc: não dá para enviar. */
  blocked: boolean;
  /** O que falta mas pode seguir assim, se a pessoa confirmar. */
  missing: string[];
  /** Texto escrito num campo de destinatários que não é um email: tem de se corrigir. */
  invalid: string[];
  /** Avisos que podem ser engano (anexo esquecido, domínio mal escrito): pergunta-se. */
  warnings: string[];
}

/** Erros de escrita frequentes no domínio → o que a pessoa queria escrever. */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.pt': 'gmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'sapo.p': 'sapo.pt',
  'spo.pt': 'sapo.pt',
  'realizeconsultoria.pt': 'realizeconsultadoria.pt',
  'realizeconsultadora.pt': 'realizeconsultadoria.pt',
  'realizeconsultadoria.com': 'realizeconsultadoria.pt',
  'dasprent.com': 'dasprent.pt',
};

/** "Queria dizer gmail.com?" para os destinatários com o domínio mal escrito. */
export const domainTypos = (emails: string[]): string[] =>
  emails.flatMap(email => {
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    const fixed =
      DOMAIN_TYPOS[domain] ?? (domain.endsWith('.con') ? domain.slice(0, -1) + 'm' : null);
    return fixed ? [`"${email}" — queria dizer @${fixed}?`] : [];
  });

/** O texto fala num anexo (em anexo, segue o ficheiro, attached…). */
export const mentionsAttachment = (text: string) =>
  /\b(anexo|anexa|anexad[oa]s?|anexei|em anexo|segue[m]? (o|a|os|as) (ficheiro|documento|pdf|proposta|fatura|contrato)|ficheiro junto|documentos? juntos?|attach(ed|ment)?)/i.test(
    text
  );

export const checkBeforeSend = (input: {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  /** Só o que a pessoa escreveu (sem a citação de uma resposta ou reencaminhamento). */
  written: string;
  attachments: number;
  /** Texto que ficou escrito num campo de destinatários sem ser um email válido. */
  unparsed?: { label: string; text: string }[];
}): SendCheck => {
  const recipients = input.to.length + input.cc.length + input.bcc.length;
  const missing: string[] = [];
  if (recipients > 0 && !input.to.length) missing.push('ninguém no campo "Para" (só Cc/Bcc)');
  if (!input.subject.trim()) missing.push('assunto');
  if (!input.written.trim() && !input.attachments) missing.push('texto da mensagem');
  const invalid = (input.unparsed ?? [])
    .filter(({ text }) => text.trim())
    .map(({ label, text }) => `"${text.trim()}" (${label})`);
  const warnings = domainTypos([...input.to, ...input.cc, ...input.bcc]);
  if (!input.attachments && mentionsAttachment(input.written))
    warnings.unshift('O texto fala num anexo, mas não há nenhum anexo.');
  return { blocked: recipients === 0, missing, invalid, warnings };
};
