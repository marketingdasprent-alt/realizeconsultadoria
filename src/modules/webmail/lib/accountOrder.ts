// Ordem das caixas na barra lateral (tabela mail_account_order, por pessoa): primeiro as que
// têm posição guardada, depois as outras pela ordem de antes (data de ligação).

/** Ordena pelas posições guardadas; as caixas sem posição ficam no fim, pela ordem recebida. */
export const applyAccountOrder = <T extends { id: string }>(
  accounts: readonly T[],
  positions: ReadonlyMap<string, number>
): T[] =>
  accounts
    .map((account, index) => ({ account, index, position: positions.get(account.id) }))
    .sort((a, b) => {
      if (a.position === undefined || b.position === undefined) {
        if (a.position !== undefined) return -1;
        if (b.position !== undefined) return 1;
        return a.index - b.index;
      }
      return a.position - b.position || a.index - b.index;
    })
    .map(entry => entry.account);

/** Lista com o item de `from` levado para `to` (índices da lista). */
export const moveItem = <T>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  if (from === to || from < 0 || from >= items.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
};

/** Ordem alfabética pelo endereço (sem distinguir maiúsculas nem acentos). */
export const sortByEmail = <T extends { email: string }>(accounts: readonly T[]): T[] =>
  [...accounts].sort((a, b) => a.email.localeCompare(b.email, 'pt', { sensitivity: 'base' }));

/**
 * Onde fica a linha arrastada: quantas das outras linhas têm o centro acima do ponteiro.
 * `centers` são os centros verticais das linhas pela ordem atual; `from` é a arrastada.
 */
export const dropIndex = (centers: readonly number[], from: number, y: number): number =>
  centers.filter((center, index) => index !== from && center < y).length;
