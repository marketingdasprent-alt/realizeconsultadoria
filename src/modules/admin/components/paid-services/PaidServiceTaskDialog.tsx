import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CYCLE_PER } from '@/lib/recurring-services';
import { TaskFormDialog } from '@/modules/tasks/components/TaskFormDialog';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { formatEuro, PAID_KIND_LABELS, type PaidService } from '../../lib/paidServices';
import { AdminWorkspaceBridge } from '../AdminWorkspaceBridge';
import { AdminTaskDialog } from './AdminTaskDialog';

interface PaidServiceTaskDialogProps {
  /** Serviço de onde nasce a tarefa; null fecha. */
  service: PaidService | null;
  companies: { id: string; name: string }[];
  onClose: () => void;
}

/** Pré-preenchida: pagar o serviço até à data da renovação, com os dados para quem trata. */
const taskFromService = (service: PaidService) => ({
  title: `Pagar ${service.name} — ${formatEuro(service.amount)}`,
  description: [
    `${PAID_KIND_LABELS[service.kind]}${service.provider ? ` · ${service.provider}` : ''}`,
    service.companyName ? `Empresa: ${service.companyName}` : null,
    `Valor: ${formatEuro(service.amount)} ${CYCLE_PER[service.cycle]}`,
    `Renova a ${format(parseISO(service.renewalDate), "d 'de' MMMM yyyy", { locale: pt })}`,
    service.notes ? `Notas: ${service.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n'),
  dueAt: new Date(`${service.renewalDate}T09:00:00`).toISOString(),
});

const TaskFromService: React.FC<{ service: PaidService; onClose: () => void }> = ({
  service,
  onClose,
}) => {
  const { user } = useWorkspace();
  const { create } = useTasks();
  const initial = useMemo(
    () => ({ ...taskFromService(service), assigneeId: user.userId }),
    [service, user.userId]
  );

  return (
    <TaskFormDialog
      open
      onOpenChange={open => !open && onClose()}
      title="Nova tarefa do serviço"
      initial={initial}
      onSave={create}
    />
  );
};

/**
 * "Criar tarefa" a partir de um serviço pago: escolher responsável, participantes e prazo.
 * Com ficha de colaborador usa o formulário do Workspace; sem ficha (admins), o do admin.
 */
export const PaidServiceTaskDialog: React.FC<PaidServiceTaskDialogProps> = ({
  service,
  companies,
  onClose,
}) =>
  service ? (
    <AdminWorkspaceBridge
      onMissing={onClose}
      fallback={
        <AdminTaskDialog
          companies={companies}
          companyId={service.companyId}
          initial={taskFromService(service)}
          onClose={onClose}
        />
      }
    >
      <TaskFromService service={service} onClose={onClose} />
    </AdminWorkspaceBridge>
  ) : null;
