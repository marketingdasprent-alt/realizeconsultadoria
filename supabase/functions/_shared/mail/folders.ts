// Pastas do Webmail → Gmail (pesquisa), Microsoft Graph (pastas conhecidas) e IMAP
// (special-use RFC 6154 com nomes habituais como alternativa).

import type { MailFolder, MailFolderInfo } from './types.ts';

export const MAIL_FOLDERS: readonly MailFolder[] = [
  'inbox',
  'unread',
  'sent',
  'drafts',
  'trash',
  'archive',
  'spam',
  'starred',
];

export const isMailFolder = (value: unknown): value is MailFolder =>
  typeof value === 'string' && (MAIL_FOLDERS as readonly string[]).includes(value);

// ---------------------------------------------------------------- Gmail

export const GMAIL_FOLDER_QUERY: Record<MailFolder, string> = {
  inbox: 'in:inbox',
  unread: 'in:inbox is:unread',
  sent: 'in:sent',
  drafts: 'in:drafts',
  trash: 'in:trash',
  spam: 'in:spam',
  archive: '-in:inbox -in:sent -in:drafts -in:trash -in:spam -in:chats',
  starred: 'is:starred',
};

/** Pesquisa Gmail da pasta + texto do utilizador (aceita a sintaxe do Gmail, ex. from:). */
export const gmailListQuery = (
  folder: MailFolder,
  userQuery: string | null
): { q: string; includeSpamTrash: boolean } => {
  const extra = userQuery?.replace(/[\r\n]+/g, ' ').trim();
  return {
    q: extra ? `${GMAIL_FOLDER_QUERY[folder]} ${extra}` : GMAIL_FOLDER_QUERY[folder],
    includeSpamTrash: folder === 'trash' || folder === 'spam',
  };
};

// ---------------------------------------------------------------- Microsoft Graph

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export const GRAPH_WELL_KNOWN_FOLDER: Record<Exclude<MailFolder, 'starred'>, string> = {
  inbox: 'inbox',
  unread: 'inbox',
  sent: 'sentitems',
  drafts: 'drafts',
  trash: 'deleteditems',
  archive: 'archive',
  spam: 'junkemail',
};

export const GRAPH_SUMMARY_FIELDS = [
  'id',
  'conversationId',
  'subject',
  'bodyPreview',
  'receivedDateTime',
  'sentDateTime',
  'lastModifiedDateTime',
  'isRead',
  'isDraft',
  'hasAttachments',
  'flag',
  'from',
  'sender',
  'toRecipients',
];

/** Texto para $search do Graph (entre aspas; sem aspas/barras do utilizador). */
const graphSearchTerm = (query: string): string =>
  `"${query
    .replace(/["\\\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()}"`;

/**
 * URL da listagem no Graph. $orderby não se combina com $search (fica a ordem de
 * relevância/data do serviço). Nas marcadas e nas por ler com pesquisa também não há $filter
 * possível, por isso `postFilterFlagged`/`postFilterUnread` pedem para filtrar a página no
 * servidor da função.
 */
export const buildGraphListUrl = (
  folder: MailFolder,
  options: { query: string | null; limit: number; root?: string; folderId?: string | null }
): { url: string; postFilterFlagged: boolean; postFilterUnread: boolean } => {
  // A própria caixa (/me) ou, com a permissão da app, a de outra pessoa (/users/<email>).
  const root = options.root ?? `${GRAPH_BASE}/me`;
  // Pasta da pessoa: lista-se como uma pasta normal (sem os filtros de marcadas/por ler).
  if (options.folderId) folder = 'inbox';
  const base = options.folderId
    ? `${root}/mailFolders/${encodeURIComponent(options.folderId)}/messages`
    : folder === 'starred'
      ? `${root}/messages`
      : `${root}/mailFolders/${GRAPH_WELL_KNOWN_FOLDER[folder]}/messages`;
  const params = [`$top=${options.limit}`, `$select=${GRAPH_SUMMARY_FIELDS.join(',')}`];
  const query = options.query?.trim();

  if (query) {
    params.push(`$search=${encodeURIComponent(graphSearchTerm(query))}`);
    return {
      url: `${base}?${params.join('&')}`,
      postFilterFlagged: folder === 'starred',
      postFilterUnread: folder === 'unread',
    };
  }
  if (folder === 'starred') {
    // O Graph exige que a propriedade do $orderby apareça primeiro no $filter.
    params.push(
      `$filter=${encodeURIComponent(
        "receivedDateTime ge 1900-01-01T00:00:00Z and flag/flagStatus eq 'flagged'"
      )}`
    );
  }
  if (folder === 'unread') {
    params.push(
      `$filter=${encodeURIComponent('receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq false')}`
    );
  }
  params.push(`$orderby=${encodeURIComponent('receivedDateTime desc')}`);
  return { url: `${base}?${params.join('&')}`, postFilterFlagged: false, postFilterUnread: false };
};

/**
 * Pastas de sistema do Outlook (nomes "well-known" do Graph). As da pessoa podem estar dentro
 * da Entrada ou do Arquivo; dentro das outras (Itens Eliminados, Problemas de Sincronização…)
 * não se mostram.
 */
export const GRAPH_SYSTEM_FOLDERS = [
  'inbox',
  'archive',
  'sentitems',
  'drafts',
  'deleteditems',
  'junkemail',
  'outbox',
  'conversationhistory',
  'syncissues',
  'clutter',
  'scheduled',
  'searchfolders',
] as const;
const GRAPH_OPEN_SYSTEM_FOLDERS = new Set(['inbox', 'archive']);

export interface GraphFolderEntry {
  id: string;
  displayName?: string;
  parentFolderId?: string;
  unreadItemCount?: number;
}

/**
 * Das pastas todas do Graph (já com as subpastas), só as da pessoa. `system`: id → nome
 * "well-known" de cada pasta de sistema que a caixa tem. As de topo dentro da Entrada ou do
 * Arquivo ficam sem mãe.
 */
export const graphCustomFolders = (
  all: GraphFolderEntry[],
  system: Map<string, string>
): MailFolderInfo[] => {
  const byId = new Map(all.map(f => [f.id, f]));
  const visible = (folder: GraphFolderEntry): boolean => {
    if (system.has(folder.id)) return false;
    let parent = folder.parentFolderId ? byId.get(folder.parentFolderId) : undefined;
    for (let depth = 0; parent && depth < 20; depth++) {
      const name = system.get(parent.id);
      if (name) return GRAPH_OPEN_SYSTEM_FOLDERS.has(name);
      parent = parent.parentFolderId ? byId.get(parent.parentFolderId) : undefined;
    }
    return true;
  };
  const kept = all.filter(visible);
  const keptIds = new Set(kept.map(f => f.id));
  return kept.map(f => ({
    id: f.id,
    name: f.displayName?.trim() || '(sem nome)',
    parent_id: f.parentFolderId && keptIds.has(f.parentFolderId) ? f.parentFolderId : null,
    unread: typeof f.unreadItemCount === 'number' ? f.unreadItemCount : null,
  }));
};

/** O page_token do Graph é o @odata.nextLink: só se aceita se for do próprio Graph. */
export const isAllowedGraphNextLink = (url: string): boolean =>
  url.startsWith('https://graph.microsoft.com/') && !/[\r\n\s]/.test(url);

// ---------------------------------------------------------------- IMAP

export const IMAP_SPECIAL_USE: Record<MailFolder, string | null> = {
  inbox: null,
  unread: null,
  sent: '\\Sent',
  drafts: '\\Drafts',
  trash: '\\Trash',
  archive: '\\Archive',
  spam: '\\Junk',
  starred: '\\Flagged',
};

/** Nomes habituais quando o servidor não anuncia special-use (comparação sem maiúsculas). */
export const IMAP_FALLBACK_NAMES: Record<MailFolder, string[]> = {
  inbox: ['INBOX'],
  // Por ler: UNSEEN na INBOX (ver driver IMAP).
  unread: ['INBOX'],
  sent: ['Sent', 'Sent Items', 'Sent Messages', 'Sent Mail', 'Enviados', 'Itens Enviados'],
  drafts: ['Drafts', 'Rascunhos'],
  trash: ['Trash', 'Deleted Items', 'Deleted Messages', 'Bin', 'Lixo', 'Reciclagem'],
  archive: ['Archive', 'Archives', 'Arquivo'],
  spam: ['Junk', 'Spam', 'Junk E-mail', 'Junk Email', 'Bulk Mail', 'Lixo Eletrónico'],
  // Sem pasta \Flagged procura-se \Flagged na INBOX (ver driver IMAP).
  starred: [],
};

export interface ImapMailboxEntry {
  path: string;
  name?: string;
  specialUse?: string;
  delimiter?: string;
  parentPath?: string;
  /** Ex.: \Noselect (pasta que só agrupa outras; não tem emails). */
  flags?: Set<string>;
}

/** Pastas IMAP da pessoa: sem a INBOX nem as que o Webmail já mostra (Enviados, Lixo…). */
export const customImapFolders = (mailboxes: ImapMailboxEntry[]): MailFolderInfo[] => {
  const fixed = new Set(
    (Object.keys(IMAP_FALLBACK_NAMES) as MailFolder[])
      .map(folder => resolveImapFolder(folder, mailboxes))
      .filter((path): path is string => !!path)
  );
  const hidden = (m: ImapMailboxEntry) =>
    m.path.toUpperCase() === 'INBOX' ||
    fixed.has(m.path) ||
    !!m.specialUse ||
    m.flags?.has('\\NonExistent') === true;
  const kept = mailboxes.filter(m => !hidden(m));
  const keptPaths = new Set(kept.map(m => m.path));
  return kept
    .filter(m => !m.flags?.has('\\Noselect') || kept.some(c => c.parentPath === m.path))
    .map(m => ({
      id: m.path,
      name: m.name ?? m.path.split(m.delimiter || '/').pop() ?? m.path,
      parent_id: m.parentPath && keptPaths.has(m.parentPath) ? m.parentPath : null,
      unread: null,
    }));
};

/** Caminho da pasta IMAP para uma pasta do Webmail, ou null se não existir. */
export const resolveImapFolder = (
  folder: MailFolder,
  mailboxes: ImapMailboxEntry[]
): string | null => {
  if (folder === 'inbox') return 'INBOX';
  const special = IMAP_SPECIAL_USE[folder];
  const bySpecial = special ? mailboxes.find(m => m.specialUse === special) : undefined;
  if (bySpecial) return bySpecial.path;

  const names = IMAP_FALLBACK_NAMES[folder].map(n => n.toLowerCase());
  for (const name of names) {
    const match = mailboxes.find(m => {
      const leaf = (m.name ?? m.path.split(m.delimiter || '/').pop() ?? m.path).toLowerCase();
      return (
        leaf === name || m.path.toLowerCase() === name || m.path.toLowerCase() === `inbox.${name}`
      );
    });
    if (match) return match.path;
  }
  return null;
};

/** Id de mensagem IMAP: "<pasta codificada>:<uid>" (a pasta pode ter ":" ou "/"). */
export const encodeImapMessageId = (path: string, uid: number): string =>
  `${encodeURIComponent(path)}:${uid}`;

export const decodeImapMessageId = (id: string): { path: string; uid: number } | null => {
  const sep = id.lastIndexOf(':');
  if (sep <= 0) return null;
  const uid = Number(id.slice(sep + 1));
  if (!Number.isInteger(uid) || uid <= 0) return null;
  try {
    const path = decodeURIComponent(id.slice(0, sep));
    return path && !/[\r\n\0]/.test(path) ? { path, uid } : null;
  } catch {
    return null;
  }
};
