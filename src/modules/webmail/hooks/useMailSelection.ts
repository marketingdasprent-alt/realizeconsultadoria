import { useMemo, useRef, useState } from 'react';
import { mailKey } from '../lib/mailFormat';
import { toggleAllSelection, toggleSelection, unreadSelection } from '../lib/selection';
import type { MailSummary } from '../types';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Emails selecionados na lista (por mailKey). Mudar de caixa, pasta ou pesquisa (`scopeKey`)
 * limpa a seleção; os emails que saem da lista (lixo, atualização) deixam de contar.
 */
export const useMailSelection = (messages: MailSummary[], scopeKey: string) => {
  const [state, setState] = useState<{ scope: string; keys: ReadonlySet<string> }>({
    scope: scopeKey,
    keys: EMPTY,
  });
  const anchor = useRef<string | null>(null);
  const keys = state.scope === scopeKey ? state.keys : EMPTY;
  const order = useMemo(() => messages.map(mailKey), [messages]);
  const unreadCount = useMemo(() => messages.filter(m => m.unread).length, [messages]);
  const selected = useMemo(() => messages.filter(m => keys.has(mailKey(m))), [messages, keys]);

  const change = (next: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setState(s => ({ scope: scopeKey, keys: next(s.scope === scopeKey ? s.keys : EMPTY) }));

  return {
    selected,
    count: selected.length,
    /** Quantos emails por ler há na lista carregada. */
    unreadCount,
    allSelected: order.length > 0 && selected.length === order.length,
    isSelected: (key: string) => keys.has(key),
    /** Clique na caixa de seleção de um email (`range`: com Shift). */
    toggle: (key: string, range: boolean) => {
      const from = anchor.current;
      anchor.current = key;
      change(current => toggleSelection(order, current, key, from, range));
    },
    /** Todos os emails carregados na lista, ou nenhum. */
    toggleAll: () => change(current => toggleAllSelection(order, current)),
    /** Só os emails por ler da lista (troca a seleção atual). */
    selectUnread: () => {
      anchor.current = null;
      change(() => unreadSelection(messages));
    },
    clear: () => {
      anchor.current = null;
      change(() => EMPTY);
    },
  };
};
