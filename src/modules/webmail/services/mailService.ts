// Webmail no Supabase: contas (tabela mail_accounts, sem o segredo) e as edge functions
// mail-oauth (ligar Google/Microsoft) e mail-api (ler, enviar, organizar).
import { supabase } from '@/integrations/supabase/client';
import { applyAccountOrder } from '../lib/accountOrder';
import type { Discovery } from '../lib/autodiscover';
import type { MailProviderKey } from '../lib/providers';
import type {
  ComposeInput,
  ImapConnectInput,
  MailAccount,
  MailAddress,
  MailFolder,
  MailMessage,
  MailSignature,
  MailSummary,
} from '../types';

/** Colunas que o colaborador pode ler (secret_id fica de fora por GRANT). */
const ACCOUNT_COLUMNS =
  'id, provider, auth_method, email, display_name, status, last_error, last_sync_at, is_default, color, access_id, notify';

export interface MailError {
  code: string;
  message: string;
}

export const MAIL_ERRORS: Record<string, string> = {
  unavailable: 'O servidor de email não respondeu. Tente de novo daqui a pouco.',
  not_configured: 'A ligação a este fornecedor ainda não foi configurada pelo administrador.',
  reauth: 'A autorização desta caixa expirou. Volte a ligá-la.',
  imap_login_failed: 'Não foi possível entrar com estes dados. Confirme o email e a palavra-passe.',
  smtp_port_blocked: 'O envio só funciona por SMTP com SSL na porta 465.',
  too_large: 'Os anexos ultrapassam 10 MB.',
  not_found: 'Esta caixa de correio já não existe.',
};

export const mailErrorText = (error: MailError | null) =>
  error ? (MAIL_ERRORS[error.code] ?? error.message) : '';

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const address = (value: unknown): MailAddress | null =>
  value && typeof value === 'object' && 'email' in value
    ? {
        name: (value as Row).name ? str((value as Row).name) : null,
        email: str((value as Row).email),
      }
    : null;
const addresses = (value: unknown) =>
  Array.isArray(value) ? (value.map(address).filter(Boolean) as MailAddress[]) : [];

const toAccount = (row: Row): MailAccount => ({
  id: str(row.id),
  provider: row.provider as MailProviderKey,
  authMethod: row.auth_method as MailAccount['authMethod'],
  email: str(row.email),
  displayName: (row.display_name as string | null) ?? null,
  label: null,
  signatures: [],
  status: row.status as MailAccount['status'],
  lastError: (row.last_error as string | null) ?? null,
  lastSyncAt: (row.last_sync_at as string | null) ?? null,
  isDefault: !!row.is_default,
  color: row.color as MailAccount['color'],
  shared: !!row.access_id,
  notify: row.notify !== false,
});

const toSummary = (accountId: string, row: Row): MailSummary => ({
  id: str(row.id),
  accountId,
  threadId: (row.thread_id as string | null) ?? null,
  from: address(row.from),
  to: addresses(row.to),
  subject: str(row.subject),
  snippet: str(row.snippet),
  date: str(row.date),
  unread: !!row.unread,
  starred: !!row.starred,
  hasAttachments: !!row.has_attachments,
});

const toMessage = (accountId: string, row: Row): MailMessage => ({
  ...toSummary(accountId, row),
  cc: addresses(row.cc),
  replyTo: addresses(row.reply_to),
  html: (row.html as string | null) ?? null,
  text: (row.text as string | null) ?? null,
  attachments: Array.isArray(row.attachments)
    ? (row.attachments as Row[]).map(a => ({
        id: str(a.id),
        filename: str(a.filename),
        mime: str(a.mime),
        size: Number(a.size) || 0,
      }))
    : [],
});

const READ_ACTIONS = new Set(['list', 'get', 'unread-counts', 'attachment', 'discover']);

/**
 * Chama uma edge function; respostas de negócio vêm como { ok, code, message, data }. Sem resposta
 * (rede, ou a BD lenta a dar 500/503) tenta mais uma vez antes de mostrar o erro — só nas leituras:
 * repetir um envio podia mandar o email duas vezes.
 */
const call = async <T>(
  fn: 'mail-api' | 'mail-oauth',
  body: Row
): Promise<{ data: T | null; error: MailError | null }> => {
  let { data, error } = await supabase.functions.invoke(fn, { body });
  if ((error || !data) && READ_ACTIONS.has(String(body.action))) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    ({ data, error } = await supabase.functions.invoke(fn, { body }));
  }
  if (error || !data) return { data: null, error: { code: 'unavailable', message: '' } };
  const result = data as Row;
  if (!result.ok)
    return {
      data: null,
      error: { code: str(result.code) || 'error', message: str(result.message) },
    };
  return { data: (result.data ?? null) as T | null, error: null };
};

export const mailService = {
  listAccounts: async () => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id ?? '';
    const [accounts, prefs, order, sigs] = await Promise.all([
      supabase.from('mail_accounts').select(ACCOUNT_COLUMNS).order('created_at'),
      // Nas caixas partilhadas, a cor e os avisos são de cada pessoa.
      supabase
        .from('mail_account_members')
        .select('account_id, color, notify')
        .eq('user_id', userId),
      // Ordem escolhida pela pessoa na barra lateral (sem ela, fica a da ligação).
      supabase
        .from('mail_account_order')
        .select('account_id, position, label')
        .eq('user_id', userId),
      // As assinaturas desta pessoa (várias por caixa).
      supabase
        .from('mail_signatures')
        .select('id, account_id, name, html, is_default')
        .eq('user_id', userId)
        .order('position'),
    ]);
    const signatures = new Map<string, MailSignature[]>();
    for (const row of sigs.data ?? []) {
      signatures.set(row.account_id, [
        ...(signatures.get(row.account_id) ?? []),
        { id: row.id, name: row.name, html: row.html, isDefault: row.is_default },
      ]);
    }
    const mine = new Map(((prefs.data ?? []) as Row[]).map(p => [str(p.account_id), p]));
    const positions = new Map((order.data ?? []).map(row => [row.account_id, row.position]));
    const labels = new Map(
      (order.data ?? []).map(row => [row.account_id, (row.label as string | null) ?? null])
    );
    const list = ((accounts.data ?? []) as Row[]).map(base => {
      const account = {
        ...toAccount(base),
        label: labels.get(str(base.id)) ?? null,
        signatures: signatures.get(str(base.id)) ?? [],
      };
      const pref = account.shared ? mine.get(account.id) : undefined;
      return pref
        ? {
            ...account,
            color: (pref.color as MailAccount['color'] | null) ?? account.color,
            notify: pref.notify !== false,
          }
        : account;
    });
    return { data: applyAccountOrder(list, positions), error: accounts.error };
  },

  /** Grava a ordem das caixas desta pessoa (posição = índice na lista). */
  saveAccountOrder: async (accountIds: string[]) => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return { error: new Error('Sessão terminada.') };
    const now = new Date().toISOString();
    const { error } = await supabase.from('mail_account_order').upsert(
      accountIds.map((accountId, position) => ({
        user_id: userId,
        account_id: accountId,
        position,
        updated_at: now,
      })),
      { onConflict: 'user_id,account_id' }
    );
    return { error };
  },

  /**
   * Nome da caixa só para esta pessoa. Grava primeiro a ordem atual de todas (senão a linha nova
   * puxava esta caixa para o topo) e depois o nome.
   */
  saveAccountLabel: async (accountId: string, label: string | null, orderedIds: string[]) => {
    const ordered = await mailService.saveAccountOrder(orderedIds);
    if (ordered.error) return ordered;
    const { data: auth } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('mail_account_order')
      .update({ label })
      .eq('user_id', auth.session?.user.id ?? '')
      .eq('account_id', accountId);
    return { error };
  },

  /**
   * Grava as assinaturas desta pessoa numa caixa: o que saiu da lista apaga-se, a predefinida
   * anterior deixa de o ser (há no máximo uma) e o resto grava-se pela ordem da lista.
   */
  saveSignatures: async (accountId: string, list: MailSignature[]) => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return { error: new Error('Sessão terminada.') };
    const mine = () =>
      supabase.from('mail_signatures').delete().eq('user_id', userId).eq('account_id', accountId);
    const removed = list.length
      ? await mine().not('id', 'in', `(${list.map(s => s.id).join(',')})`)
      : await mine();
    if (removed.error) return removed;
    const cleared = await supabase
      .from('mail_signatures')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('account_id', accountId);
    if (cleared.error || !list.length) return cleared;
    return supabase.from('mail_signatures').upsert(
      list.map((signature, position) => ({
        id: signature.id,
        user_id: userId,
        account_id: accountId,
        name: signature.name,
        html: signature.html,
        is_default: signature.isDefault,
        position,
      }))
    );
  },

  /** Emails por ler na Entrada de cada caixa (as que falharem ficam sem número). */
  unreadCounts: () =>
    call<{ counts: Record<string, number>; errors: Record<string, string> }>('mail-api', {
      action: 'unread-counts',
    }),

  updateAccount: async (
    id: string,
    patch: Partial<Pick<MailAccount, 'displayName' | 'isDefault' | 'color' | 'notify'>>,
    shared = false
  ) => {
    if (shared) {
      // Caixa partilhada: só as preferências da própria pessoa (cor e avisos).
      const { data: auth } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('mail_account_members')
        .update({
          ...(patch.color !== undefined && { color: patch.color }),
          ...(patch.notify !== undefined && { notify: patch.notify }),
        })
        .eq('account_id', id)
        .eq('user_id', auth.session?.user.id ?? '');
      return { error };
    }
    const { error } = await supabase
      .from('mail_accounts')
      .update({
        ...(patch.displayName !== undefined && { display_name: patch.displayName }),
        ...(patch.isDefault !== undefined && { is_default: patch.isDefault }),
        ...(patch.color !== undefined && { color: patch.color }),
        ...(patch.notify !== undefined && { notify: patch.notify }),
      })
      .eq('id', id);
    return { error };
  },

  /** Endereço da janela de autorização do Google ou da Microsoft. */
  startOAuth: (provider: MailProviderKey, redirectTo: string) =>
    call<{ url: string }>('mail-oauth', { action: 'start', provider, redirect_to: redirectTo }),

  connectImap: (input: ImapConnectInput) =>
    call<{ id: string }>('mail-api', {
      action: 'connect-imap',
      provider: input.provider,
      email: input.email,
      password: input.password,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      display_name: input.displayName,
    }),

  /** Servidores do domínio, descobertos no servidor (DNS nativo; o browser pode não ter). */
  discover: (email: string) => call<Discovery>('mail-api', { action: 'discover', email }),

  /** Admin: partilha o email departamental de um acesso com os colaboradores escolhidos. */
  shareAccess: (accessId: string) =>
    call<{ account_id: string; email: string; members: number }>('mail-api', {
      action: 'share-access',
      access_id: accessId,
    }),

  disconnect: (accountId: string) =>
    call('mail-api', { action: 'disconnect', account_id: accountId }),

  list: async (accountId: string, folder: MailFolder, query: string, pageToken: string | null) => {
    const { data, error } = await call<{ messages: Row[]; next_page_token: string | null }>(
      'mail-api',
      { action: 'list', account_id: accountId, folder, query, page_token: pageToken ?? undefined }
    );
    return {
      data: data
        ? {
            messages: data.messages.map(row => toSummary(accountId, row)),
            nextPageToken: data.next_page_token,
          }
        : null,
      error,
    };
  },

  /** As mensagens da mesma conversa, mais antiga primeiro (vazio sem agrupamento). */
  thread: async (accountId: string, threadId: string) => {
    const { data, error } = await call<Row[]>('mail-api', {
      action: 'thread',
      account_id: accountId,
      thread_id: threadId,
    });
    return { data: data ? data.map(row => toSummary(accountId, row)) : null, error };
  },

  get: async (accountId: string, messageId: string) => {
    const { data, error } = await call<Row>('mail-api', {
      action: 'get',
      account_id: accountId,
      message_id: messageId,
    });
    return { data: data ? toMessage(accountId, data) : null, error };
  },

  /** `filename` deixa as caixas IMAP descarregarem só esse anexo (muito mais rápido). */
  attachment: (accountId: string, messageId: string, attachmentId: string, filename?: string) =>
    call<{ filename: string; mime: string; base64: string }>('mail-api', {
      action: 'attachment',
      filename,
      account_id: accountId,
      message_id: messageId,
      attachment_id: attachmentId,
    }),

  send: (input: ComposeInput, html: string) =>
    call<{ id: string | null }>('mail-api', {
      action: 'send',
      account_id: input.accountId,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html,
      in_reply_to: input.inReplyTo,
      attachments: input.attachments,
    }),

  /** Guarda (ou substitui `draftId`) o rascunho na pasta Rascunhos; devolve o id novo. */
  saveDraft: (input: ComposeInput, html: string, draftId: string | null) =>
    call<{ id: string }>('mail-api', {
      action: 'save-draft',
      account_id: input.accountId,
      draft_id: draftId ?? undefined,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html,
      in_reply_to: input.inReplyTo,
      attachments: input.attachments,
    }),

  deleteDraft: (accountId: string, draftId: string) =>
    call('mail-api', { action: 'delete-draft', account_id: accountId, message_id: draftId }),

  setRead: (accountId: string, messageId: string, read: boolean) =>
    call('mail-api', { action: 'set-read', account_id: accountId, message_id: messageId, read }),

  setStarred: (accountId: string, messageId: string, starred: boolean) =>
    call('mail-api', {
      action: 'set-starred',
      account_id: accountId,
      message_id: messageId,
      starred,
    }),

  trash: (accountId: string, messageId: string) =>
    call('mail-api', { action: 'trash', account_id: accountId, message_id: messageId }),
};
