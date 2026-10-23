import { useMailAccounts } from './useMailAccounts';
import { useUnreadCounts } from './useUnreadCounts';

/** Total de emails por ler (menu da app): pedido leve, de minuto a minuto fora do Webmail. */
export const useMailUnreadTotal = (): number => {
  const { accounts } = useMailAccounts();
  return useUnreadCounts(accounts, 60_000).total;
};
