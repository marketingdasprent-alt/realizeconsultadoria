// Pesquisa em todas as pastas (ver docs/webmail-pesquisa-todas-pastas.md): regras sem dependências
// do Deno, para se poderem testar. Os drivers (IMAP, Microsoft 365, Gmail) usam estas funções.

import type { GraphFolderEntry, ImapMailboxEntry } from './folders.ts';
import { resolveImapFolder } from './folders.ts';
import type { MailSummary } from './types.ts';

/** Pesquisa curta demais não vale a pena (e varreria a caixa toda). */
export const SEARCH_ALL_MIN_LENGTH = 2;
export const SEARCH_ALL_MAX_RESULTS = 100;
export const SEARCH_ALL_MAX_QUERY = 200;
/** IMAP: tempo máximo (ms) a pesquisar pasta a pasta; ao acabar devolve o que tem, com partial. */
export const SEARCH_ALL_BUDGET_MS = 40_000;

export type SearchAllRequest =
  | { kind: 'off' }
  | { kind: 'invalid' }
  | { kind: 'ok'; query: string; includeBody: boolean; limit: number };

/**
 * Lê os campos novos do pedido list. `off`: não pediu pesquisa em todas as pastas (o pedido segue
 * como sempre). `invalid`: pediu, mas a pesquisa tem menos de 2 caracteres (bad_request).
 * Só `all_folders === true` liga o modo: qualquer outro valor é ignorado.
 */
export const parseSearchAllRequest = (body: Record<string, unknown>): SearchAllRequest => {
  if (body.all_folders !== true) return { kind: 'off' };
  const raw = typeof body.query === 'string' ? body.query : '';
  const query = raw
    .replace(/[\r\n\0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_ALL_MAX_QUERY)
    .trim();
  if ([...query].length < SEARCH_ALL_MIN_LENGTH) return { kind: 'invalid' };
  const asked = Number(body.limit);
  const limit =
    body.limit === undefined || body.limit === null || !Number.isFinite(asked)
      ? SEARCH_ALL_MAX_RESULTS
      : Math.min(SEARCH_ALL_MAX_RESULTS, Math.max(1, Math.floor(asked)));
  return { kind: 'ok', query, includeBody: body.include_body === true, limit };
};

/** Junta os resultados de várias pastas: sem repetidos, do mais recente para o mais antigo, no máximo `limit`. */
export const mergeSearchResults = (
  groups: MailSummary[][],
  limit: number
): { messages: MailSummary[]; truncated: boolean } => {
  const seen = new Set<string>();
  const all = groups.flat().filter(mail => !seen.has(mail.id) && seen.add(mail.id));
  const time = (mail: MailSummary) => {
    const ms = Date.parse(mail.date);
    return Number.isFinite(ms) ? ms : 0;
  };
  all.sort((a, b) => time(b) - time(a) || (a.id < b.id ? -1 : 1));
  return { messages: all.slice(0, limit), truncated: all.length > limit };
};

/** Sem acentos e em minúsculas (para comparar "Joao" com "João"). */
export const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** O texto aparece (sem ligar a maiúsculas nem acentos) em algum dos campos? */
export const headerMatches = (query: string, fields: (string | null | undefined)[]): boolean => {
  const wanted = foldText(query);
  return fields.some(field => !!field && foldText(field).includes(wanted));
};

// ---------------------------------------------------------------- nomes das pastas

export const FOLDER_NAME_INBOX = 'Entrada';
export const FOLDER_NAME_SENT = 'Enviados';
export const FOLDER_NAME_DRAFTS = 'Rascunhos';
export const FOLDER_NAME_ARCHIVE = 'Arquivo';

// ---------------------------------------------------------------- IMAP

/**
 * Critério IMAP: assunto, de, para e cc (e o texto, se pedido). Os OR vão encadeados de dois em
 * dois, que é como o protocolo os define (OR a OR b OR c d).
 */
export const imapSearchAllCriteria = (
  query: string,
  includeBody: boolean
): Record<string, unknown> => {
  const items: Record<string, unknown>[] = [
    { subject: query },
    { from: query },
    { to: query },
    { cc: query },
  ];
  if (includeBody) items.push({ body: query });
  const chain = (list: Record<string, unknown>[]): Record<string, unknown> =>
    list.length === 1 ? list[0] : { or: [list[0], chain(list.slice(1))] };
  return chain(items);
};

export interface ImapSearchFolder {
  path: string;
  /** Nome para mostrar (em português para as pastas padrão). */
  name: string;
}

/**
 * Pastas IMAP onde se pesquisa: todas as que têm emails, menos Lixo e Spam (e o que está dentro
 * delas), as que só agrupam outras (\Noselect), as que não existem e as virtuais (\Flagged, \All).
 * A Entrada vem primeiro.
 */
export const imapSearchFolders = (mailboxes: ImapMailboxEntry[]): ImapSearchFolder[] => {
  const trash = resolveImapFolder('trash', mailboxes);
  const spam = resolveImapFolder('spam', mailboxes);
  const sent = resolveImapFolder('sent', mailboxes);
  const drafts = resolveImapFolder('drafts', mailboxes);
  const archive = resolveImapFolder('archive', mailboxes);
  const excludedRoots = mailboxes
    .filter(m => m.specialUse === '\\Trash' || m.specialUse === '\\Junk')
    .map(m => m.path)
    .concat([trash, spam].filter((p): p is string => !!p));
  const insideExcluded = (m: ImapMailboxEntry): boolean =>
    excludedRoots.some(root => {
      if (m.path === root) return true;
      const sep = m.delimiter || '/';
      return m.path.startsWith(`${root}${sep}`) || m.path.startsWith(`${root}.`);
    });
  const nameOf = (m: ImapMailboxEntry): string => {
    if (m.path.toUpperCase() === 'INBOX') return FOLDER_NAME_INBOX;
    if (m.path === sent || m.specialUse === '\\Sent') return FOLDER_NAME_SENT;
    if (m.path === drafts || m.specialUse === '\\Drafts') return FOLDER_NAME_DRAFTS;
    if (m.path === archive || m.specialUse === '\\Archive') return FOLDER_NAME_ARCHIVE;
    return m.name?.trim() || m.path.split(m.delimiter || '/').pop() || m.path;
  };
  const folders = mailboxes
    .filter(
      m =>
        !m.flags?.has('\\Noselect') &&
        !m.flags?.has('\\NonExistent') &&
        m.specialUse !== '\\Flagged' &&
        m.specialUse !== '\\All' &&
        !insideExcluded(m)
    )
    .map(m => ({ path: m.path, name: nameOf(m) }));
  // Sem a INBOX na lista (servidor que não a anuncia), pesquisa-se na mesma
  if (!folders.some(f => f.path.toUpperCase() === 'INBOX'))
    folders.unshift({ path: 'INBOX', name: FOLDER_NAME_INBOX });
  return folders.sort(
    (a, b) => Number(b.name === FOLDER_NAME_INBOX) - Number(a.name === FOLDER_NAME_INBOX)
  );
};

// ---------------------------------------------------------------- Microsoft 365

const GRAPH_SYSTEM_NAMES_PT: Record<string, string> = {
  inbox: FOLDER_NAME_INBOX,
  sentitems: FOLDER_NAME_SENT,
  drafts: FOLDER_NAME_DRAFTS,
  archive: FOLDER_NAME_ARCHIVE,
};
const GRAPH_EXCLUDED = new Set(['deleteditems', 'junkemail']);

/**
 * Das pastas do Microsoft 365: o nome de cada uma (em português para as padrão) e se está no Lixo
 * ou no Spam (também as subpastas deles). `system`: id → nome "well-known" das pastas de sistema.
 */
export const graphSearchFolderIndex = (all: GraphFolderEntry[], system: Map<string, string>) => {
  const byId = new Map(all.map(f => [f.id, f]));
  return {
    isExcluded: (folderId: string | null | undefined): boolean => {
      let current = folderId ?? undefined;
      for (let depth = 0; current && depth < 20; depth++) {
        const name = system.get(current);
        if (name && GRAPH_EXCLUDED.has(name)) return true;
        current = byId.get(current)?.parentFolderId ?? undefined;
      }
      return false;
    },
    nameOf: (folderId: string | null | undefined): string | null => {
      if (!folderId) return null;
      const name = system.get(folderId);
      if (name && GRAPH_SYSTEM_NAMES_PT[name]) return GRAPH_SYSTEM_NAMES_PT[name];
      return byId.get(folderId)?.displayName?.trim() || null;
    },
  };
};

const SEARCH_FIELDS_EXTRA = ['parentFolderId', 'ccRecipients'];

/** Campos pedidos ao Graph na pesquisa em todas as pastas (os da lista, mais a pasta e o cc). */
export const graphSearchAllSelect = (base: string[]): string =>
  [...new Set([...base, ...SEARCH_FIELDS_EXTRA])].join(',');

/**
 * URL da pesquisa à caixa toda (não à pasta): $search com o termo já entre aspas. Pede mais do que
 * o necessário (até 250), porque depois tiram-se o Lixo e o Spam e, sem texto, os que só acertam
 * no corpo.
 */
export const graphSearchAllUrl = (
  root: string,
  term: string,
  limit: number,
  select: string
): string => {
  const top = Math.min(250, Math.max(limit * 2, limit));
  return `${root}/messages?$top=${top}&$select=${select}&$search=${encodeURIComponent(term)}`;
};

/**
 * Pesquisas extra do Graph só para uma palavra (sem espaços): o $search simples procura em
 * remetente, assunto e corpo; "para" e "cc" só se pedem com a propriedade. Em contas pessoais
 * (Outlook.com) o Graph recusa-as, e então ficam sem efeito.
 */
export const graphRecipientTerms = (query: string): string[] => {
  const token = query.replace(/["\\]/g, '');
  if (!token || /\s/.test(token)) return [];
  return [`"to:${token}"`, `"cc:${token}"`];
};

// ---------------------------------------------------------------- Gmail

/**
 * Pesquisa Gmail em todas as etiquetas (o Gmail já deixa de fora Spam e Lixo). Só cabeçalhos:
 * {subject:"…" from:"…" to:"…" cc:"…"}; com o texto, o termo simples (que procura em tudo).
 */
export const gmailSearchAllQuery = (query: string, includeBody: boolean): string => {
  const clean = query
    .replace(/["\\\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (includeBody) return clean;
  return `{subject:"${clean}" from:"${clean}" to:"${clean}" cc:"${clean}"}`;
};

const GMAIL_SYSTEM_NAMES_PT: [string, string][] = [
  ['INBOX', FOLDER_NAME_INBOX],
  ['SENT', FOLDER_NAME_SENT],
  ['DRAFT', FOLDER_NAME_DRAFTS],
];

/**
 * Nome da "pasta" de um email do Gmail, pelas etiquetas: Entrada, Enviados ou Rascunhos; senão a
 * primeira etiqueta da pessoa (último nível de "Clientes/Norte"); senão null (arquivado).
 */
export const gmailFolderName = (
  labelIds: string[] | undefined,
  userLabels: Map<string, string>
): string | null => {
  const labels = labelIds ?? [];
  for (const [id, name] of GMAIL_SYSTEM_NAMES_PT) if (labels.includes(id)) return name;
  for (const id of labels) {
    const name = userLabels.get(id);
    if (name) return name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name;
  }
  return null;
};
