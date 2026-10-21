import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { linkableAccounts, suggestedAccount } from '../lib/adminLink';
import { adminLinkService } from '../services/adminLinkService';

interface EmployeeForLink {
  id: string;
  name: string;
  user_id: string | null;
  admin_user_id?: string | null;
}

const ACCOUNTS_KEY = ['admin', 'admin-accounts'];

/** Ficha → Conta de administrador: a conta ligada, a sugerida e ligar/desligar (super admin). */
export const useEmployeeAdminAccount = (employee: EmployeeForLink, onChanged: () => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminPermissions();
  const [isSaving, setIsSaving] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => (await adminLinkService.accounts()).data,
    enabled: isSuperAdmin,
  });

  const linked = accounts.find(account => account.userId === employee.admin_user_id) ?? null;
  // Conta única: o login do colaborador já é de admin (não há nada para ligar).
  const sameAccount = !!employee.user_id && accounts.some(a => a.userId === employee.user_id);
  const options = linkableAccounts(accounts);
  const suggestion = linked || sameAccount ? null : suggestedAccount(accounts, employee.name);

  const link = async (adminUserId: string | null) => {
    setIsSaving(true);
    const { error } = await adminLinkService.link(employee.id, adminUserId);
    setIsSaving(false);
    toast(
      error
        ? { title: 'Não foi possível guardar a ligação', variant: 'destructive' }
        : { title: adminUserId ? 'Conta de admin ligada' : 'Conta de admin desligada' }
    );
    if (error) return;
    void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    // O botão "Ir para Workspace" de quem está a ligar a própria conta.
    void queryClient.invalidateQueries({ queryKey: ['auth', 'switch-targets'] });
    onChanged();
  };

  return { isSuperAdmin, isLoading, linked, sameAccount, options, suggestion, isSaving, link };
};
