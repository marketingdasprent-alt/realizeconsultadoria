// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  GraphFolderEntry,
  ImapMailboxEntry,
} from '../../../supabase/functions/_shared/mail/folders';
import {
  SEARCH_ALL_MAX_RESULTS,
  foldText,
  gmailFolderName,
  gmailSearchAllQuery,
  graphRecipientTerms,
  graphSearchAllSelect,
  graphSearchAllUrl,
  graphSearchFolderIndex,
  headerMatches,
  imapSearchAllCriteria,
  imapSearchFolders,
  mergeSearchResults,
  parseSearchAllRequest,
} from '../../../supabase/functions/_shared/mail/search-all';
import type { MailSummary } from '../../../supabase/functions/_shared/mail/types';

describe('parseSearchAllRequest (compatibilidade e validação)', () => {
  it('sem all_folders o pedido segue como sempre (off), qualquer que seja o resto', () => {
    expect(parseSearchAllRequest({ action: 'list', folder: 'inbox', query: 'fatura' })).toEqual({
      kind: 'off',
    });
    expect(parseSearchAllRequest({ all_folders: false, query: 'fatura' })).toEqual({ kind: 'off' });
    // só o booleano true liga o modo
    expect(parseSearchAllRequest({ all_folders: 'true', query: 'fatura' })).toEqual({
      kind: 'off',
    });
    expect(parseSearchAllRequest({ all_folders: 1, query: 'fatura' })).toEqual({ kind: 'off' });
  });
  it('com all_folders exige 2 ou mais letras depois de aparar', () => {
    expect(parseSearchAllRequest({ all_folders: true })).toEqual({ kind: 'invalid' });
    expect(parseSearchAllRequest({ all_folders: true, query: '' })).toEqual({ kind: 'invalid' });
    expect(parseSearchAllRequest({ all_folders: true, query: '  a  ' })).toEqual({
      kind: 'invalid',
    });
    expect(parseSearchAllRequest({ all_folders: true, query: 12345 })).toEqual({ kind: 'invalid' });
    expect(parseSearchAllRequest({ all_folders: true, query: 'ab' }).kind).toBe('ok');
  });
  it('limpa o texto (espaços, quebras de linha) e corta a 200 caracteres', () => {
    const parsed = parseSearchAllRequest({ all_folders: true, query: '  carta \r\n  verde  ' });
    expect(parsed).toMatchObject({ kind: 'ok', query: 'carta verde' });
    const long = parseSearchAllRequest({ all_folders: true, query: 'x'.repeat(500) });
    expect(long.kind === 'ok' && long.query.length).toBe(200);
  });
  it('include_body só com true; o limite vai de 1 a 100 e por omissão é 100', () => {
    const base = { all_folders: true, query: 'ana' };
    expect(parseSearchAllRequest(base)).toMatchObject({ includeBody: false, limit: 100 });
    expect(parseSearchAllRequest({ ...base, include_body: true })).toMatchObject({
      includeBody: true,
    });
    expect(parseSearchAllRequest({ ...base, include_body: 'sim' })).toMatchObject({
      includeBody: false,
    });
    expect(parseSearchAllRequest({ ...base, limit: 25 })).toMatchObject({ limit: 25 });
    expect(parseSearchAllRequest({ ...base, limit: 5000 })).toMatchObject({
      limit: SEARCH_ALL_MAX_RESULTS,
    });
    expect(parseSearchAllRequest({ ...base, limit: 0 })).toMatchObject({ limit: 1 });
    expect(parseSearchAllRequest({ ...base, limit: 'x' })).toMatchObject({ limit: 100 });
  });
  it('folder, folder_id, label_id, filters e page_token não são precisos nem contam', () => {
    expect(
      parseSearchAllRequest({
        all_folders: true,
        query: 'ana',
        folder: 'nada',
        folder_id: 'x',
        label_id: 'y',
        filters: ['unread'],
        page_token: 'z',
      }).kind
    ).toBe('ok');
  });
});

const mail = (id: string, date: string, over: Partial<MailSummary> = {}): MailSummary => ({
  id,
  thread_id: null,
  from: null,
  to: [],
  subject: id,
  snippet: '',
  date,
  unread: false,
  starred: false,
  has_attachments: false,
  ...over,
});

describe('mergeSearchResults', () => {
  it('junta pastas do mais recente para o mais antigo, sem repetidos', () => {
    const a = [mail('a1', '2026-01-03T10:00:00Z'), mail('a2', '2025-12-01T10:00:00Z')];
    const b = [mail('b1', '2026-01-05T10:00:00Z'), mail('a1', '2026-01-03T10:00:00Z')];
    const out = mergeSearchResults([a, b], 10);
    expect(out.messages.map(m => m.id)).toEqual(['b1', 'a1', 'a2']);
    expect(out.truncated).toBe(false);
  });
  it('corta ao limite e diz que havia mais', () => {
    const many = Array.from({ length: 5 }, (_, i) => mail(`m${i}`, `2026-01-0${i + 1}T00:00:00Z`));
    const out = mergeSearchResults([many], 3);
    expect(out.messages.map(m => m.id)).toEqual(['m4', 'm3', 'm2']);
    expect(out.truncated).toBe(true);
    expect(mergeSearchResults([many], 5).truncated).toBe(false);
  });
  it('datas inválidas vão para o fim, e a ordem é estável (por id)', () => {
    const out = mergeSearchResults(
      [[mail('b', 'lixo'), mail('a', 'lixo'), mail('c', '2026-01-01T00:00:00Z')]],
      10
    );
    expect(out.messages.map(m => m.id)).toEqual(['c', 'a', 'b']);
  });
  it('sem resultados', () => {
    expect(mergeSearchResults([], 10)).toEqual({ messages: [], truncated: false });
  });
});

describe('headerMatches', () => {
  it('ignora maiúsculas e acentos e procura em vários campos', () => {
    expect(foldText('João Álvares')).toBe('joao alvares');
    expect(headerMatches('joao', ['Orçamento', 'João Silva'])).toBe(true);
    expect(headerMatches('ORÇAMENTO', ['orcamento 2026'])).toBe(true);
    expect(headerMatches('carta verde', ['Pedido de carta verde urgente'])).toBe(true);
    expect(headerMatches('zzz', ['Orçamento', null, undefined, ''])).toBe(false);
  });
});

describe('IMAP', () => {
  it('o critério procura em assunto, de, para e cc; com texto, também no corpo (OR encadeados)', () => {
    expect(imapSearchAllCriteria('ana', false)).toEqual({
      or: [{ subject: 'ana' }, { or: [{ from: 'ana' }, { or: [{ to: 'ana' }, { cc: 'ana' }] }] }],
    });
    const withBody = JSON.stringify(imapSearchAllCriteria('ana', true));
    expect(withBody).toContain('"body":"ana"');
    expect(withBody.match(/"or"/g)).toHaveLength(4);
  });

  const box = (path: string, over: Partial<ImapMailboxEntry> = {}): ImapMailboxEntry => ({
    path,
    delimiter: '/',
    ...over,
  });
  const mailboxes: ImapMailboxEntry[] = [
    box('Sent', { specialUse: '\\Sent' }),
    box('INBOX'),
    box('Drafts', { specialUse: '\\Drafts' }),
    box('Trash', { specialUse: '\\Trash' }),
    box('Trash/Velhos'),
    box('Junk', { specialUse: '\\Junk' }),
    box('Archive', { specialUse: '\\Archive' }),
    box('Clientes', { flags: new Set(['\\Noselect']) }),
    box('Clientes/Norte', { name: 'Norte', parentPath: 'Clientes' }),
    box('Fantasma', { flags: new Set(['\\NonExistent']) }),
    box('Marcadas', { specialUse: '\\Flagged' }),
  ];
  it('todas as pastas menos Lixo, Spam (e o que está dentro), sem pastas só de grupo, inexistentes ou virtuais', () => {
    const paths = imapSearchFolders(mailboxes).map(f => f.path);
    expect(paths).toEqual(['INBOX', 'Sent', 'Drafts', 'Archive', 'Clientes/Norte']);
  });
  it('nomes em português; a pasta da pessoa leva o último nível', () => {
    const names = Object.fromEntries(imapSearchFolders(mailboxes).map(f => [f.path, f.name]));
    expect(names).toEqual({
      INBOX: 'Entrada',
      Sent: 'Enviados',
      Drafts: 'Rascunhos',
      Archive: 'Arquivo',
      'Clientes/Norte': 'Norte',
    });
  });
  it('a Entrada vem primeiro e é pesquisada mesmo que o servidor não a anuncie', () => {
    const folders = imapSearchFolders([box('Sent', { specialUse: '\\Sent' })]);
    expect(folders[0]).toEqual({ path: 'INBOX', name: 'Entrada' });
  });
  it('Lixo e Spam reconhecidos só pelo nome (sem special-use) e com ponto como separador', () => {
    const dotted = [
      box('INBOX', { delimiter: '.' }),
      box('Trash', { delimiter: '.' }),
      box('Trash.Antigos', { delimiter: '.' }),
      box('Spam', { delimiter: '.' }),
      box('Projetos', { delimiter: '.' }),
    ];
    expect(imapSearchFolders(dotted).map(f => f.path)).toEqual(['INBOX', 'Projetos']);
  });
});

describe('Microsoft 365', () => {
  const system = new Map([
    ['id-inbox', 'inbox'],
    ['id-sent', 'sentitems'],
    ['id-drafts', 'drafts'],
    ['id-archive', 'archive'],
    ['id-trash', 'deleteditems'],
    ['id-junk', 'junkemail'],
  ]);
  const all: GraphFolderEntry[] = [
    { id: 'id-inbox', displayName: 'Caixa de Entrada' },
    { id: 'id-trash', displayName: 'Itens Eliminados' },
    { id: 'id-sub-trash', displayName: 'Velhos', parentFolderId: 'id-trash' },
    { id: 'id-sub-sub', displayName: 'Muito velhos', parentFolderId: 'id-sub-trash' },
    { id: 'id-clientes', displayName: ' Clientes ', parentFolderId: 'id-inbox' },
  ];
  const index = graphSearchFolderIndex(all, system);

  it('exclui Lixo, Spam e tudo o que está dentro deles', () => {
    expect(index.isExcluded('id-trash')).toBe(true);
    expect(index.isExcluded('id-junk')).toBe(true);
    expect(index.isExcluded('id-sub-trash')).toBe(true);
    expect(index.isExcluded('id-sub-sub')).toBe(true);
    expect(index.isExcluded('id-inbox')).toBe(false);
    expect(index.isExcluded('id-clientes')).toBe(false);
    expect(index.isExcluded('desconhecida')).toBe(false);
    expect(index.isExcluded(null)).toBe(false);
  });
  it('nomes em português para as pastas padrão e o nome da pasta nas outras', () => {
    expect(index.nameOf('id-inbox')).toBe('Entrada');
    expect(index.nameOf('id-sent')).toBe('Enviados');
    expect(index.nameOf('id-drafts')).toBe('Rascunhos');
    expect(index.nameOf('id-archive')).toBe('Arquivo');
    expect(index.nameOf('id-clientes')).toBe('Clientes');
    expect(index.nameOf('desconhecida')).toBeNull();
    expect(index.nameOf(undefined)).toBeNull();
  });
  it('o URL pesquisa a caixa toda com $search, pede a pasta e o cc, e traz mais do que o limite', () => {
    const select = graphSearchAllSelect(['id', 'subject', 'toRecipients']);
    expect(select.split(',')).toEqual([
      'id',
      'subject',
      'toRecipients',
      'parentFolderId',
      'ccRecipients',
    ]);
    expect(graphSearchAllSelect(['id', 'parentFolderId']).split(',')).toEqual([
      'id',
      'parentFolderId',
      'ccRecipients',
    ]);
    const url = graphSearchAllUrl(
      'https://graph.microsoft.com/v1.0/me',
      '"carta verde"',
      100,
      select
    );
    expect(url.startsWith('https://graph.microsoft.com/v1.0/me/messages?$top=200&')).toBe(true);
    expect(url).toContain('$search=%22carta%20verde%22');
    expect(url).not.toContain('mailFolders');
    expect(url).not.toContain('$orderby');
    expect(url).not.toContain('$filter');
    expect(graphSearchAllUrl('https://x/me', '"a"', 200, 'id')).toContain('$top=250&');
  });
  it('as pesquisas extra por "to:" e "cc:" só para uma palavra', () => {
    expect(graphRecipientTerms('ana')).toEqual(['"to:ana"', '"cc:ana"']);
    expect(graphRecipientTerms('ana@exemplo.pt')).toEqual([
      '"to:ana@exemplo.pt"',
      '"cc:ana@exemplo.pt"',
    ]);
    expect(graphRecipientTerms('carta verde')).toEqual([]);
    expect(graphRecipientTerms('"')).toEqual([]);
    expect(graphRecipientTerms('a"b\\c')).toEqual(['"to:abc"', '"cc:abc"']);
  });
});

describe('Gmail', () => {
  it('só cabeçalhos: assunto, de, para e cc, sem restringir etiquetas', () => {
    const q = gmailSearchAllQuery('carta verde', false);
    expect(q).toBe('{subject:"carta verde" from:"carta verde" to:"carta verde" cc:"carta verde"}');
    expect(q).not.toContain('label:');
    expect(q).not.toContain('in:');
  });
  it('com texto, o termo simples (procura em tudo) e sem aspas do utilizador', () => {
    expect(gmailSearchAllQuery('carta verde', true)).toBe('carta verde');
    expect(gmailSearchAllQuery('a"b\nc', false)).toBe(
      '{subject:"a b c" from:"a b c" to:"a b c" cc:"a b c"}'
    );
  });
  it('nome da pasta pelas etiquetas', () => {
    const user = new Map([
      ['Label_1', 'Clientes/Norte'],
      ['Label_2', 'Faturas'],
    ]);
    expect(gmailFolderName(['INBOX', 'UNREAD', 'Label_2'], user)).toBe('Entrada');
    expect(gmailFolderName(['SENT'], user)).toBe('Enviados');
    expect(gmailFolderName(['DRAFT'], user)).toBe('Rascunhos');
    expect(gmailFolderName(['CATEGORY_PERSONAL', 'Label_1'], user)).toBe('Norte');
    expect(gmailFolderName(['Label_2'], user)).toBe('Faturas');
    expect(gmailFolderName(['CATEGORY_UPDATES'], user)).toBeNull();
    expect(gmailFolderName(undefined, user)).toBeNull();
  });
});
