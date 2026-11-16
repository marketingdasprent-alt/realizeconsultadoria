// Filtros da lista de emails (como no Gmail: não lidos, com estrela, com anexos). Combinam-se
// entre si (E) e com a pasta, a pesquisa e os marcadores. Filtram os emails já carregados; a
// lista vai buscar mais páginas sozinha até haver resultados (ver useAutoLoadMore).
import type { MailSummary } from '../types';
import { mailKey } from './mailFormat';

export type ListFilterKey = 'unread' | 'starred' | 'attachments';
export type ListFilter = ReadonlySet<ListFilterKey>;

export const NO_FILTER: ListFilter = new Set<ListFilterKey>();

export const LIST_FILTERS: readonly { key: ListFilterKey; label: string }[] = [
  { key: 'unread', label: 'Não lidos' },
  { key: 'starred', label: 'Com estrela' },
  { key: 'attachments', label: 'Com anexos' },
];

export const isFiltering = (filter: ListFilter): boolean => filter.size > 0;

/** Liga ou desliga um filtro (devolve um conjunto novo). */
export const toggleFilter = (filter: ListFilter, key: ListFilterKey): ListFilter => {
  const next = new Set(filter);
  if (!next.delete(key)) next.add(key);
  return next;
};

const MATCH: Record<ListFilterKey, (mail: MailSummary) => boolean> = {
  unread: mail => mail.unread,
  starred: mail => mail.starred,
  attachments: mail => mail.hasAttachments,
};

/**
 * Só os emails que cumprem todos os filtros ligados (sem filtros, a lista como está).
 * `opened`: os que a pessoa abriu com "Não lidos" ligado. Passam a lidos mas ficam na lista
 * (como no Gmail) até se mudar o filtro, a pasta ou atualizar; senão sumiam ao abri-los.
 */
export const applyListFilter = (
  messages: MailSummary[],
  filter: ListFilter,
  opened: ReadonlySet<string> = new Set()
): MailSummary[] => {
  if (!isFiltering(filter)) return messages;
  const keys = [...filter];
  return messages.filter(mail =>
    keys.every(key => (key === 'unread' && opened.has(mailKey(mail)) ? true : MATCH[key](mail)))
  );
};

/** Chave estável do conjunto de filtros (para reiniciar a seleção e o carregamento). */
export const filterKey = (filter: ListFilter): string =>
  LIST_FILTERS.filter(item => filter.has(item.key))
    .map(item => item.key)
    .join('+');

const EMPTY_TEXT: Record<ListFilterKey, string> = {
  unread: 'Sem emails não lidos aqui.',
  starred: 'Sem emails com estrela aqui.',
  attachments: 'Sem emails com anexos aqui.',
};

/** Texto da lista vazia quando há filtros ligados. */
export const filterEmptyText = (filter: ListFilter): string => {
  const keys = LIST_FILTERS.filter(item => filter.has(item.key)).map(item => item.key);
  return keys.length === 1
    ? EMPTY_TEXT[keys[0]]
    : 'Nenhum email aqui cumpre todos os filtros escolhidos.';
};

/** Páginas que se carregam sozinhas, seguidas e sem a pessoa rolar, antes de pedir um clique. */
export const MAX_AUTO_PAGES = 3;
/** Com filtros (à procura de resultados) vale a pena insistir mais. */
export const MAX_AUTO_PAGES_FILTERING = 8;

export const maxAutoPages = (filtering: boolean): number =>
  filtering ? MAX_AUTO_PAGES_FILTERING : MAX_AUTO_PAGES;
