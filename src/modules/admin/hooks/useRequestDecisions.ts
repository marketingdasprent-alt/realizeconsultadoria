import { useToast } from '@/hooks/use-toast';
import type { AbsenceRequest } from '../lib/absenceRequests';
import type { useAbsenceRequests } from './useAbsenceRequests';

type RequestsData = Pick<ReturnType<typeof useAbsenceRequests>, 'approve' | 'reject' | 'unapprove'>;

/** Aprovar, rejeitar e desaprovar com o aviso do resultado (quantos, conflitos, erros). */
export const useRequestDecisions = (data: RequestsData) => {
  const { toast } = useToast();

  const approve = async (requests: AbsenceRequest[]) => {
    const outcome = await data.approve(requests);
    if (outcome.approved.length > 0)
      toast({
        title:
          outcome.approved.length === 1
            ? `Aprovado: ${outcome.approved[0].employee.name}`
            : `${outcome.approved.length} pedidos aprovados`,
      });
    outcome.conflicts.forEach(({ request, reason }) =>
      toast({
        title: `Não aprovado: ${request.employee.name}`,
        description: `${reason} Reprove o outro pedido antes de aprovar este.`,
        variant: 'destructive',
      })
    );
    if (outcome.failed.length > 0)
      toast({
        title:
          outcome.failed.length === 1
            ? `Erro ao aprovar o pedido de ${outcome.failed[0].employee.name}`
            : `Erro ao aprovar ${outcome.failed.length} pedidos`,
        variant: 'destructive',
      });
  };

  const reject = async (requests: AbsenceRequest[], reason: string) => {
    const failed = await data.reject(requests, reason);
    const done = requests.length - failed.length;
    if (done > 0) toast({ title: done === 1 ? 'Pedido rejeitado' : `${done} pedidos rejeitados` });
    if (failed.length > 0) toast({ title: 'Erro ao rejeitar', variant: 'destructive' });
  };

  const unapprove = async (request: AbsenceRequest, note: string) => {
    const ok = await data.unapprove(request, note);
    toast(
      ok
        ? { title: 'Pedido desaprovado', description: 'Voltou a pendente; o saldo foi devolvido.' }
        : { title: 'Erro ao desaprovar', variant: 'destructive' }
    );
  };

  return { approve, reject, unapprove };
};
