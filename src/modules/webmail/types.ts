// Tipos do Webmail (briefing §9). As mensagens vêm das edge functions (mail-api), que
// falam com o Gmail, o Microsoft Graph ou o servidor IMAP; nada é guardado na BD.
import type { MailProviderKey } from './lib/providers';

/** 'unread' = os por ler da Entrada (um filtro, como 'starred'). */
export type MailFolder =
  'inbox' | 'unread' | 'starred' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';
export type MailAccountColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';

/** Uma assinatura (HTML já limpo) com nome, como no Outlook. */
export interface MailSignature {
  id: string;
  name: string;
  html: string;
  isDefault: boolean;
}

export interface MailAccount {
  id: string;
  provider: MailProviderKey;
  authMethod: 'oauth-google' | 'oauth-microsoft' | 'imap';
  email: string;
  displayName: string | null;
  /** Nome que a própria pessoa deu à caixa na barra lateral (null = o endereço). */
  label: string | null;
  /** Assinaturas desta pessoa nesta caixa (a predefinida é usada ao escrever). */
  signatures: MailSignature[];
  status: 'active' | 'error' | 'reauth';
  lastError: string | null;
  lastSyncAt: string | null;
  isDefault: boolean;
  color: MailAccountColor;
  /** Partilhada pelo admin (email departamental dos Acessos): só o admin a gere. */
  shared: boolean;
  /** Avisar (notificação) dos emails novos desta caixa; nas partilhadas é de cada pessoa. */
  notify: boolean;
}

export interface MailAddress {
  name: string | null;
  email: string;
}

export interface MailSummary {
  id: string;
  accountId: string;
  threadId: string | null;
  from: MailAddress | null;
  to: MailAddress[];
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  hasAttachments: boolean;
}

export interface MailAttachmentInfo {
  id: string;
  filename: string;
  mime: string;
  size: number;
}

export interface MailMessage extends MailSummary {
  cc: MailAddress[];
  replyTo: MailAddress[];
  html: string | null;
  text: string | null;
  attachments: MailAttachmentInfo[];
}

export interface OutgoingAttachment {
  filename: string;
  mime: string;
  base64: string;
}

export interface ComposeInput {
  accountId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  /** Texto escrito pelo utilizador (com a citação, se for resposta). */
  text: string;
  /** Assinatura em HTML a juntar ao enviar (antes da citação). */
  signatureHtml?: string | null;
  /** Reencaminhar: o email original em HTML (com cabeçalho), no lugar da citação em texto. */
  quotedHtml?: string | null;
  inReplyTo?: string;
  attachments: OutgoingAttachment[];
}

/** Rascunho inicial do compositor (responder, reencaminhar, novo). */
export interface ComposeDraft {
  accountId?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  bcc?: string;
  inReplyTo?: string;
  /** Rascunho devolvido por um envio falhado: já tem a assinatura. */
  restored?: boolean;
  /** Reencaminhar: o HTML original e os anexos a voltar a anexar. */
  forward?: {
    messageId: string;
    accountId: string;
    html: string;
    attachments: MailAttachmentInfo[];
  };
}

export interface ImapConnectInput {
  provider: MailProviderKey;
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  displayName?: string;
}
