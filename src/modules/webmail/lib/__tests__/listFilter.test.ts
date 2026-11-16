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

describe('maxAutoPages', () => {
  it('com filtros insiste mais', () => {
    expect(maxAutoPages(false)).toBe(MAX_AUTO_PAGES);
    expect(maxAutoPages(true)).toBe(MAX_AUTO_PAGES_FILTERING);
    expect(MAX_AUTO_PAGES_FILTERING).toBeGreaterThan(MAX_AUTO_PAGES);
  });
});
