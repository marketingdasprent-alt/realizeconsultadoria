import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEmployees } from '@/hooks/useEmployees';
import type { Employee } from '../services/employeeService';

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Dados e ações da lista de colaboradores: eliminar, ativar/desativar e re-enviar convite,
 * com o estado dos diálogos (avisos, senha, eliminar, senha nova do convite).
 */
export const useEmployeeListActions = () => {
  const { toast } = useToast();
  const { employees, isLoading, deleteEmployee, toggleStatus, resendInvite } = useEmployees();
  const [noticesFor, setNoticesFor] = useState<Employee | null>(null);
  const [passwordFor, setPasswordFor] = useState<Employee | null>(null);
  const [deleteFor, setDeleteFor] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ name: string; password: string } | null>(null);

  const confirmDelete = async () => {
    if (!deleteFor) return;
    setIsDeleting(true);
    const { error } = await deleteEmployee(deleteFor.id);
    setIsDeleting(false);
    if (error) {
      toast({
        title: 'Erro',
        description: message(error, 'Ocorreu um erro ao eliminar.'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Colaborador eliminado' });
    setDeleteFor(null);
  };

  const toggle = async (employee: Employee) => {
    const { error } = await toggleStatus(employee.id, !employee.is_active);
    if (error) {
      toast({
        title: 'Erro ao atualizar estado',
        description: message(error, 'Erro desconhecido.'),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: employee.is_active ? 'Colaborador desativado' : 'Colaborador ativado',
      description: employee.name,
    });
  };

  const resend = async (employee: Employee) => {
    setResendingId(employee.id);
    const result = await resendInvite(employee.id, employee.name);
    setResendingId(null);
    if (!result.success) {
      toast({
        title: 'Erro ao re-enviar',
        description: message(result.error, 'Ocorreu um erro desconhecido.'),
        variant: 'destructive',
      });
      return;
    }
    setInvite({ name: employee.name, password: result.newPassword ?? '' });
    toast(
      result.emailSuccess
        ? { title: 'Convite re-enviado' }
        : {
            title: 'Convite enviado (sem email)',
            description: 'A senha foi alterada, mas o email falhou. Partilhe a senha.',
            variant: 'destructive',
          }
    );
  };

  return {
    employees,
    isLoading,
    noticesFor,
    setNoticesFor,
    passwordFor,
    setPasswordFor,
    deleteFor,
    setDeleteFor,
    isDeleting,
    confirmDelete,
    toggle,
    resend,
    resendingId,
    invite,
    setInvite,
  };
};
