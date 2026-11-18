import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { companyMembershipService } from '../services/companyMembershipService';
import {
  canManageCompany,
  canOfferMove,
  membershipErrorText,
  manageableCompanies,
} from '../lib/companyMembership';
import { useMyCompanies, useRefreshSharing } from './useSharing';

/**
 * Que empresas o utilizador administra (rz_my_companies), para o "Mover para empresa…": só
 * aparece para quem administra a empresa atual da ficha, e só se houver para onde mover.
 */
export const useMoveAccess = () => {
  const query = useMyCompanies();
  const mine = useMemo(() => query.data ?? [], [query.data]);
  return {
    isLoading: query.isLoading,
    companies: mine,
    destinations: useMemo(() => manageableCompanies(mine), [mine]),
    canMoveFrom: (companyId: string) => canManageCompany(mine, companyId),
    canOfferMove: (employee: { company_id: string }) => canOfferMove(mine, employee),
  };
};

/** Colaboradores com conta de uma empresa, para escolher quem passa a administrador. */
export const useCompanyEmployeesWithAccount = (company: string) =>
  useQuery({
    queryKey: ['admin', 'company-employees-with-account', company],
    queryFn: () => companyMembershipService.companyEmployeesWithAccount(company),
    staleTime: 30_000,
  });

/**
 * Executa uma escrita de administradores: mostra o resultado, relê quem tem acesso à empresa e,
 * se falhar, mostra o texto em português da base (nunca o código técnico).
 */
export const useMembershipAction = () => {
  const { toast } = useToast();
  const refresh = useRefreshSharing();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>, success: string): Promise<T | undefined> => {
      setPending(true);
      try {
        const result = await action();
        toast({ title: success });
        await refresh();
        return result;
      } catch (error) {
        toast({
          title: 'Não foi possível concluir',
          description: membershipErrorText(error),
          variant: 'destructive',
        });
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast, refresh]
  );

  return { run, pending };
};
