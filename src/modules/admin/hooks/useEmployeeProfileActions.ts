import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '../services/employeeService';

const CHARS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';

/** Senha aleatória de 12 caracteres (sem os que se confundem: l, I, O, 0, 1). */
const randomPassword = (): string => {
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, value => CHARS[value % CHARS.length]).join('');
};

interface ProfileTarget {
  id: string;
  name: string;
  is_active: boolean;
}

/** Ações do cabeçalho da ficha: re-enviar convite (senha nova) e ativar/desativar. */
export const useEmployeeProfileActions = (employee: ProfileTarget, onChanged: () => void) => {
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [invitePassword, setInvitePassword] = useState<string | null>(null);

  const resendInvite = async () => {
    setIsResending(true);
    const password = randomPassword();
    const { data, error } = await employeeService.resendInvite(employee.id, password);
    setIsResending(false);
    if (error || !data?.success) {
      toast({
        title: 'Erro ao re-enviar',
        description:
          (error instanceof Error && error.message) || data?.error || 'Erro ao re-enviar convite',
        variant: 'destructive',
      });
      return;
    }
    setInvitePassword(password);
    toast({
      title: data.email_success ? 'Convite re-enviado' : 'Convite enviado (sem email)',
      variant: data.email_success ? 'default' : 'destructive',
    });
  };

  const toggleStatus = async () => {
    setIsToggling(true);
    const { error } = await employeeService.update(employee.id, { is_active: !employee.is_active });
    setIsToggling(false);
    if (error) {
      toast({
        title: 'Erro ao atualizar estado',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: employee.is_active ? 'Colaborador desativado' : 'Colaborador ativado' });
    onChanged();
  };

  return {
    resendInvite,
    isResending,
    toggleStatus,
    isToggling,
    invitePassword,
    clearInvite: () => setInvitePassword(null),
  };
};
