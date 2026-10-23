// Tipos partilhados do Webmail (edge functions mail-oauth / mail-api e testes Vitest).
// Sem dependências de Deno/Node. As respostas para o browser usam snake_case.

/** 'unread' = os por ler da Entrada (como 'starred', é um filtro e não uma pasta). */
export type MailFolder =
  'inbox' | 'unread' | 'sent' | 'drafts' | 'trash' | 'archive' | 'spam' | 'starred';

export type MailProviderKey =
  | 'gmail'
  | 'outlook'
  | 'office365'
  | 'exchange'
  | 'icloud'
  | 'yahoo'
  | 'aol'
  | 'imap';

export type MailAuthMethod = 'oauth-google' | 'oauth-microsoft' | 'imap' | 'app-microsoft';

export type OAuthProvider = 'google' | 'microsoft';

export interface MailAddress {
  name: string | null;
  email: string;
}

export interface MailSummary {
  id: string;
  thread_id: string | null;
  from: MailAddress | null;
  to: MailAddress[];
  subject: string;
  snippet: string;
  /** ISO 8601. */
  date: string;
  unread: boolean;
  starred: boolean;
  has_attachments: boolean;
}

export interface MailAttachmentInfo {
  id: string;
  filename: string;
  mime: string;
  size: number;
}

export interface MailMessage extends MailSummary {
  cc: MailAddress[];
  reply_to: MailAddress[];
  html: string | null;
  text: string | null;
  attachments: MailAttachmentInfo[];
  message_id_header: string | null;
  references: string | null;
}

export interface MailAttachmentContent {
  filename: string;
  mime: string;
  base64: string;
}

export interface MailListParams {
  folder: MailFolder;
  query: string | null;
  pageToken: string | null;
  limit: number;
  /** Sem o início do texto de cada email (mais rápido; os avisos de email novo não o usam). */
  withoutSnippets?: boolean;
}

export interface MailListResult {
  messages: MailSummary[];
  next_page_token: string | null;
}

export interface OutgoingAttachment {
  filename: string;
  mime: string;
  base64: string;
}

/** Envio (o remetente é sempre a própria conta). */
export interface MailSendParams {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  html: string;
  text: string;
  /** Id (nosso) da mensagem a que se responde. */
  inReplyTo: string | null;
  attachments: OutgoingAttachment[];
  /** Conteúdo já descodificado dos anexos (mesma ordem de attachments). */
  attachmentBytes: Uint8Array[];
}

/** Operações que cada fornecedor (Gmail API, Microsoft Graph, IMAP/SMTP) implementa. */
export interface MailDriver {
  list(params: MailListParams): Promise<MailListResult>;
  get(messageId: string): Promise<MailMessage>;
  /** `filename` (opcional) deixa o IMAP descarregar só essa parte em vez do email todo. */
  attachment(
    messageId: string,
    attachmentId: string,
    filename?: string | null
  ): Promise<MailAttachmentContent>;
  send(params: MailSendParams): Promise<{ id: string | null }>;
  setRead(messageId: string, read: boolean): Promise<void>;
  setStarred(messageId: string, starred: boolean): Promise<void>;
  trash(messageId: string): Promise<void>;
  /**
   * Guarda o rascunho na pasta Rascunhos do fornecedor; com `draftId` substitui esse.
   * Devolve o id (nosso) da mensagem guardada, que pode mudar a cada gravação.
   */
  saveDraft(params: MailSendParams, draftId: string | null): Promise<{ id: string }>;
  /** Apaga um rascunho (depois de enviado ou descartado). Já apagado não é erro. */
  deleteDraft(draftId: string): Promise<void>;
  /**
   * As mensagens da mesma conversa (mais antiga primeiro, sem rascunhos nem lixo). Sem
   * agrupamento pelo fornecedor (IMAP), devolve vazio.
   */
  thread(threadId: string): Promise<MailSummary[]>;
  /** Emails por ler na caixa de entrada (um pedido leve, sem listar mensagens). */
  unreadCount(): Promise<number>;
}

/** Segredo guardado no Vault para contas OAuth. */
export interface OAuthSecret {
  access_token: string;
  refresh_token: string | null;
  /** Epoch em ms. */
  expires_at: number;
  scope: string | null;
}

/** Segredo guardado no Vault para contas IMAP. */
export interface ImapSecret {
  username: string;
  password: string;
}
