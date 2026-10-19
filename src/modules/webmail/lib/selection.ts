// Seleção de vários emails na lista: um a um, intervalo com Shift e todos os da página.

/**
 * Marca ou desmarca `key`. Com `range` e uma âncora (o último email clicado) que ainda está na
 * lista, todo o intervalo entre os dois fica no novo estado de `key`, como no Gmail.
 */
export const toggleSelection = (
  order: readonly string[],
  selected: ReadonlySet<string>,
  key: string,
  anchor: string | null,
  range: boolean
): Set<string> => {
  const next = new Set(selected);
  const on = !selected.has(key);
  const to = order.indexOf(key);
  const from = range && anchor ? order.indexOf(anchor) : -1;
  const keys =
    from >= 0 && to >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [key];
  keys.forEach(k => (on ? next.add(k) : next.delete(k)));
  return next;
};

/** Todos os emails da página ou, se já estavam todos marcados, nenhum. */
export const toggleAllSelection = (
  order: readonly string[],
  selected: ReadonlySet<string>
): Set<string> =>
  order.length > 0 && order.every(key => selected.has(key)) ? new Set() : new Set(order);
