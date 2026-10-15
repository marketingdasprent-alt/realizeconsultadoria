// Tipos do Webmail (briefing §9). As mensagens vêm das edge functions (mail-api), que
// falam com o Gmail, o Microsoft Graph ou o servidor IMAP; nada é guardado na BD.
import type { MailProviderKey } from './lib/providers';

export type MailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';
export type MailAccountColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';

export interface MailAccount {
  id: string;
  provider: MailProviderKey;
  authMethod: 'oauth-google' | 'oauth-microsoft' | 'imap';
  email: string;
  displayName: string | null;
  signature: string | null;
  status: 'active' | 'error' | 'reauth';
  lastError: string | null;
  lastSyncAt: string | null;
  isDefault: boolean;
  color: MailAccountColor;
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
  /** Texto escrito pelo utilizador (a assinatura e a citação já incluídas). */
  text: string;
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
