// Antes de enviar: o que falta no email (sem destinatário não se envia; o resto pergunta-se).

export interface SendCheck {
  /** Sem ninguém em Para, Cc ou Bcc: não dá para enviar. */
  blocked: boolean;
  /** O que falta mas pode seguir assim, se a pessoa confirmar. */
  missing: string[];
}

export const checkBeforeSend = (input: {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  /** Só o que a pessoa escreveu (sem a citação de uma resposta ou reencaminhamento). */
  written: string;
  attachments: number;
}): SendCheck => {
  const recipients = input.to.length + input.cc.length + input.bcc.length;
  const missing: string[] = [];
  if (recipients > 0 && !input.to.length) missing.push('ninguém no campo "Para" (só Cc/Bcc)');
  if (!input.subject.trim()) missing.push('assunto');
  if (!input.written.trim() && !input.attachments) missing.push('texto da mensagem');
  return { blocked: recipients === 0, missing };
};
