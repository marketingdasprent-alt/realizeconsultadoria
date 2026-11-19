import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { COMPANIES_ACTIVE_KEY } from '../context/CompanyScopeContext';
import { companyMembershipService } from '../services/companyMembershipService';
import {
  canManageCompany,
  canOfferMove,
  membershipErrorText,
  manageableCompanies,
} from '../lib/companyMembership';
import { isReauthRequired } from '../lib/sharing';
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

/** Raiz das listas de fichas por empresa (a da própria empresa e a dos candidatos de fora). */
export const COMPANY_EMPLOYEES_KEY = ['admin', 'company-employees'] as const;

/** Colaboradores ativos de uma empresa, para a secção "Colaboradores" da página da empresa. */
export const useCompanyEmployees = (company: string) =>
  useQuery({
    queryKey: [...COMPANY_EMPLOYEES_KEY, 'list', company],
    queryFn: () => companyMembershipService.companyEmployees(company),
    staleTime: 30_000,
  });

/** Fichas ativas das outras empresas; só se lê quando o seletor está aberto. */
export const useEmployeesOutsideCompany = (company: string, enabled: boolean) =>
  useQuery({
    queryKey: [...COMPANY_EMPLOYEES_KEY, 'outside', company],
    queryFn: () => companyMembershipService.employeesOutsideCompany(company),
    enabled,
    staleTime: 0,
  });

/**
 * Depois de mover fichas: relê as listas de colaboradores por empresa, os candidatos a administrador
 * (dependem de quem é da empresa) e o seletor de empresa do admin.
 */
export const useRefreshCompanyEmployees = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: COMPANY_EMPLOYEES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'company-employees-with-account'] }),
        queryClient.invalidateQueries({ queryKey: COMPANIES_ACTIVE_KEY }),
      ]),
    [queryClient]
  );
};

/**
 * Executa uma escrita de administradores: mostra o resultado, relê quem tem acesso à empresa e,
 * se a base pedir a palavra-passe outra vez (`reauth_required`), abre o diálogo e repete a
 * chamada uma vez. Se falhar, mostra o texto em português da base (nunca o código técnico).
 * O ecrã tem de mostrar `<ReauthDialog open={reauthOpen} onDone={finishReauth} />`.
 */
export const useMembershipAction = () => {
  const { toast } = useToast();
  const refresh = useRefreshSharing();
  const [pending, setPending] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const askReauth = () =>
    new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setReauthOpen(true);
    });

  const finishReauth = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setReauthOpen(false);
  }, []);

  /** Devolve o resultado, ou `undefined` se falhou ou a pessoa desistiu da palavra-passe. */
  const run = useCallback(
    async <T>(action: () => Promise<T>, success: string): Promise<T | undefined> => {
      setPending(true);
      try {
        let result: T;
        try {
          result = await action();
        } catch (error) {
          if (!isReauthRequired(error)) throw error;
          if (!(await askReauth())) return undefined;
          result = await action();
        }
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

  return { run, pending, reauthOpen, finishReauth };
};
