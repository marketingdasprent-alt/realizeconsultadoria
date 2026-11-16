import { describe, expect, it } from 'vitest';
import type { MailSummary } from '../../types';
import {
  MAX_AUTO_PAGES,
  MAX_AUTO_PAGES_FILTERING,
  NO_FILTER,
  applyListFilter,
  filterEmptyText,
  filterKey,
  isFiltering,
  maxAutoPages,
  serverFilters,
  toggleFilter,
} from '../listFilter';
import { mailKey } from '../mailFormat';

const mail = (id: string, over: Partial<MailSummary> = {}): MailSummary => ({
  id,
  accountId: 'a1',
  threadId: null,
  from: null,
  to: [],
  subject: id,
  snippet: '',
  date: '2026-11-16T10:00:00Z',
  unread: false,
  starred: false,
  hasAttachments: false,
  ...over,
});

const list = [
  mail('lido'),
  mail('novo', { unread: true }),
  mail('estrela', { starred: true }),
  mail('anexo', { hasAttachments: true }),
  mail('novo-anexo', { unread: true, hasAttachments: true }),
];
const ids = (mails: MailSummary[]) => mails.map(m => m.id);

describe('toggleFilter', () => {
  it('liga e desliga sem mexer no conjunto original', () => {
    const on = toggleFilter(NO_FILTER, 'unread');
    expect(on.has('unread')).toBe(true);
    expect(NO_FILTER.size).toBe(0);
    expect(toggleFilter(on, 'unread').size).toBe(0);
  });
  it('isFiltering só com filtros ligados', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering(toggleFilter(NO_FILTER, 'starred'))).toBe(true);
  });
});

describe('Lidos e Não lidos', () => {
  it('excluem-se: ligar um desliga o outro, sem mexer nos outros filtros', () => {
    const unread = toggleFilter(toggleFilter(NO_FILTER, 'attachments'), 'unread');
    const read = toggleFilter(unread, 'read');
    expect(read.has('read')).toBe(true);
    expect(read.has('unread')).toBe(false);
    expect(read.has('attachments')).toBe(true);
    const back = toggleFilter(read, 'unread');
    expect(back.has('unread')).toBe(true);
    expect(back.has('read')).toBe(false);
  });
  it('desligar "Lidos" não liga "Não lidos"', () => {
    const read = toggleFilter(NO_FILTER, 'read');
    expect(toggleFilter(read, 'read').size).toBe(0);
  });
  it('"Lidos" mostra só os já lidos e combina com os outros', () => {
    const read = toggleFilter(NO_FILTER, 'read');
    expect(ids(applyListFilter(list, read))).toEqual(['lido', 'estrela', 'anexo']);
    expect(ids(applyListFilter(list, toggleFilter(read, 'attachments')))).toEqual(['anexo']);
  });
  it('texto da lista vazia e filtros pedidos ao servidor', () => {
    expect(filterEmptyText(toggleFilter(NO_FILTER, 'read'))).toBe('Sem emails lidos aqui.');
    expect(serverFilters(toggleFilter(toggleFilter(NO_FILTER, 'attachments'), 'read'))).toEqual([
      'read',
      'attachments',
    ]);
    expect(serverFilters(NO_FILTER)).toEqual([]);
  });
});

describe('applyListFilter', () => {
  it('sem filtros devolve a mesma lista', () => {
    expect(applyListFilter(list, NO_FILTER)).toBe(list);
  });
  it('não lidos, com estrela e com anexos mostram só os certos', () => {
    expect(ids(applyListFilter(list, toggleFilter(NO_FILTER, 'unread')))).toEqual([
      'novo',
      'novo-anexo',
    ]);
    expect(ids(applyListFilter(list, toggleFilter(NO_FILTER, 'starred')))).toEqual(['estrela']);
    expect(ids(applyListFilter(list, toggleFilter(NO_FILTER, 'attachments')))).toEqual([
      'anexo',
      'novo-anexo',
    ]);
  });
  it('combinados, têm de cumprir todos (E)', () => {
    const both = toggleFilter(toggleFilter(NO_FILTER, 'unread'), 'attachments');
    expect(ids(applyListFilter(list, both))).toEqual(['novo-anexo']);
  });
  it('os abertos com "Não lidos" ligado ficam na lista, mas ainda precisam dos outros filtros', () => {
    const opened = new Set([mailKey(list[0]), mailKey(list[3])]); // "lido" e "anexo", já abertos
    const unread = toggleFilter(NO_FILTER, 'unread');
    expect(ids(applyListFilter(list, unread, opened))).toEqual([
      'lido',
      'novo',
      'anexo',
      'novo-anexo',
    ]);
    const withAttach = toggleFilter(unread, 'attachments');
    expect(ids(applyListFilter(list, withAttach, opened))).toEqual(['anexo', 'novo-anexo']);
  });
});

describe('filterKey e textos', () => {
  it('a chave segue a ordem dos filtros, não a de os ligar', () => {
    const a = toggleFilter(toggleFilter(NO_FILTER, 'attachments'), 'unread');
    const b = toggleFilter(toggleFilter(NO_FILTER, 'unread'), 'attachments');
    expect(filterKey(a)).toBe('unread+attachments');
    expect(filterKey(b)).toBe(filterKey(a));
    expect(filterKey(NO_FILTER)).toBe('');
  });
  it('lista vazia: texto claro por filtro e um geral para combinações', () => {
    expect(filterEmptyText(toggleFilter(NO_FILTER, 'unread'))).toBe('Sem emails não lidos aqui.');
    expect(filterEmptyText(toggleFilter(NO_FILTER, 'starred'))).toBe(
      'Sem emails com estrela aqui.'
    );
    expect(filterEmptyText(toggleFilter(NO_FILTER, 'attachments'))).toBe(
      'Sem emails com anexos aqui.'
    );
    expect(filterEmptyText(toggleFilter(toggleFilter(NO_FILTER, 'unread'), 'starred'))).toMatch(
      /cumpre todos os filtros/
    );
  });
});

describe('filterEmptyText com pesquisa', () => {
  it('com texto de pesquisa a mensagem é neutra, seja qual for o filtro', () => {
    const unread = toggleFilter(NO_FILTER, 'unread');
    expect(filterEmptyText(unread, true)).toBe('Nenhum email encontrado.');
    expect(filterEmptyText(toggleFilter(unread, 'starred'), true)).toBe('Nenhum email encontrado.');
    expect(filterEmptyText(unread, false)).toBe('Sem emails não lidos aqui.');
  });
});

describe('maxAutoPages', () => {
  it('com filtros insiste mais', () => {
    expect(maxAutoPages(false)).toBe(MAX_AUTO_PAGES);
    expect(maxAutoPages(true)).toBe(MAX_AUTO_PAGES_FILTERING);
    expect(MAX_AUTO_PAGES_FILTERING).toBeGreaterThan(MAX_AUTO_PAGES);
  });
});
