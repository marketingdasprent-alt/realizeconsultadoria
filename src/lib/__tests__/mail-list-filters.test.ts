// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyMailListFilters,
  buildGraphListUrl,
  gmailLabelListQuery,
  gmailListQuery,
} from '../../../supabase/functions/_shared/mail/folders';
import { parseListFilters } from '../../../supabase/functions/_shared/mail/request';
import type { MailSummary } from '../../../supabase/functions/_shared/mail/types';

const decoded = (url: string) => decodeURIComponent(url);

describe('parseListFilters (pedido novo, opcional)', () => {
  it('sem o parâmetro (pedidos antigos) não há filtros', () => {
    expect(parseListFilters(undefined)).toBeUndefined();
    expect(parseListFilters(null)).toBeUndefined();
    expect(parseListFilters('unread')).toBeUndefined();
    expect(parseListFilters([])).toBeUndefined();
  });
  it('aceita os quatro filtros e ignora o que não conhece', () => {
    expect(parseListFilters(['unread', 'starred', 'attachments', 'lixo', 7])).toEqual({
      unread: true,
      starred: true,
      attachments: true,
    });
    expect(parseListFilters(['read'])).toEqual({ read: true });
    expect(parseListFilters(['lixo'])).toBeUndefined();
  });
  it('lidos e não lidos juntos (impossível) não filtram por leitura', () => {
    expect(parseListFilters(['unread', 'read'])).toBeUndefined();
    expect(parseListFilters(['unread', 'read', 'attachments'])).toEqual({ attachments: true });
  });
});

describe('Gmail: pesquisa com filtros', () => {
  it('sem filtros é exatamente a pesquisa de antes', () => {
    expect(gmailListQuery('inbox', null)).toEqual({ q: 'in:inbox', includeSpamTrash: false });
    expect(gmailListQuery('inbox', 'fatura', undefined)).toEqual({
      q: 'in:inbox fatura',
      includeSpamTrash: false,
    });
    expect(gmailListQuery('inbox', null, {})).toEqual({ q: 'in:inbox', includeSpamTrash: false });
  });
  it('junta is:unread, is:read, is:starred e has:attachment, antes do texto', () => {
    expect(gmailListQuery('inbox', null, { unread: true, attachments: true }).q).toBe(
      'in:inbox is:unread has:attachment'
    );
    expect(gmailListQuery('sent', 'from:ana', { read: true, starred: true }).q).toBe(
      'in:sent is:read is:starred from:ana'
    );
  });
  it('pasta da pessoa (etiqueta): só filtros e texto; sem nada, sem pesquisa', () => {
    expect(gmailLabelListQuery(null)).toBeNull();
    expect(gmailLabelListQuery('  ')).toBeNull();
    expect(gmailLabelListQuery('fatura')).toBe('fatura');
    expect(gmailLabelListQuery('fatura', { attachments: true })).toBe('has:attachment fatura');
    expect(gmailLabelListQuery(null, { unread: true })).toBe('is:unread');
  });
});

describe('Graph: $filter com filtros', () => {
  const filterOf = (url: string) => new URL(url).searchParams.get('$filter') ?? null;

  it('sem filtros a Entrada não tem $filter (igual a antes)', () => {
    const { url } = buildGraphListUrl('inbox', { query: null, limit: 25 });
    expect(filterOf(url)).toBeNull();
    expect(buildGraphListUrl('inbox', { query: null, limit: 25, filters: {} }).url).toBe(url);
  });
  it('as pastas Não lidos e Com estrela mantêm o $filter de antes', () => {
    expect(filterOf(buildGraphListUrl('unread', { query: null, limit: 25 }).url)).toBe(
      'receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq false'
    );
    expect(filterOf(buildGraphListUrl('starred', { query: null, limit: 25 }).url)).toBe(
      "receivedDateTime ge 1900-01-01T00:00:00Z and flag/flagStatus eq 'flagged'"
    );
  });
  it('isRead, flag e hasAttachments entram no $filter, com receivedDateTime primeiro', () => {
    const f = (filters: object) =>
      filterOf(buildGraphListUrl('inbox', { query: null, limit: 25, filters }).url);
    expect(f({ unread: true })).toBe(
      'receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq false'
    );
    expect(f({ read: true })).toBe('receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq true');
    expect(f({ attachments: true })).toBe(
      'receivedDateTime ge 1900-01-01T00:00:00Z and hasAttachments eq true'
    );
    expect(f({ unread: true, starred: true, attachments: true })).toBe(
      "receivedDateTime ge 1900-01-01T00:00:00Z and isRead eq false and flag/flagStatus eq 'flagged' and hasAttachments eq true"
    );
  });
  it('não repete a condição que a pasta já tem', () => {
    const url = buildGraphListUrl('unread', {
      query: null,
      limit: 25,
      filters: { unread: true, attachments: true },
    }).url;
    expect(decoded(url).match(/isRead eq false/g)).toHaveLength(1);
    expect(decoded(url)).toContain('hasAttachments eq true');
  });
  it('pasta da pessoa e pesquisa de texto não usam as condições da pasta', () => {
    const custom = buildGraphListUrl('starred', {
      query: null,
      limit: 25,
      folderId: 'abc',
      filters: { attachments: true },
    }).url;
    expect(decoded(custom)).not.toContain('flagged');
    expect(decoded(custom)).toContain('hasAttachments eq true');
    // Com $search o Graph não aceita $filter: o filtro fica para a página lida
    const search = buildGraphListUrl('inbox', {
      query: 'fatura',
      limit: 25,
      filters: { attachments: true },
    }).url;
    expect(filterOf(search)).toBeNull();
  });
});

describe('applyMailListFilters (rede de segurança no servidor)', () => {
  const mail = (id: string, over: Partial<MailSummary> = {}): MailSummary => ({
    id,
    thread_id: null,
    from: null,
    to: [],
    subject: id,
    snippet: '',
    date: '2026-11-16T10:00:00Z',
    unread: false,
    starred: false,
    has_attachments: false,
    ...over,
  });
  const list = [
    mail('lido'),
    mail('novo', { unread: true }),
    mail('estrela', { starred: true }),
    mail('anexo', { has_attachments: true }),
  ];
  const ids = (mails: MailSummary[]) => mails.map(m => m.id);

  it('sem filtros devolve a lista tal como está', () => {
    expect(applyMailListFilters(list)).toBe(list);
  });
  it('filtra por cada critério e combina-os', () => {
    expect(ids(applyMailListFilters(list, { unread: true }))).toEqual(['novo']);
    expect(ids(applyMailListFilters(list, { read: true }))).toEqual(['lido', 'estrela', 'anexo']);
    expect(ids(applyMailListFilters(list, { starred: true }))).toEqual(['estrela']);
    expect(ids(applyMailListFilters(list, { read: true, attachments: true }))).toEqual(['anexo']);
  });
});
