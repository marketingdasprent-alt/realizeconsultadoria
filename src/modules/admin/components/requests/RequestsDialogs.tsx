import React from 'react';
import AbsenceApprovalDialog from '@/components/admin/AbsenceApprovalDialog';
import AbsenceDocumentsDialog from '@/components/admin/AbsenceDocumentsDialog';
import AbsenceEditDialog from '@/components/admin/AbsenceEditDialog';
import AdminAddAbsenceDialog from '@/components/admin/AdminAddAbsenceDialog';
import AdminBulkAbsenceDialog from '@/components/admin/AdminBulkAbsenceDialog';
import type { Holiday } from '@/lib/vacation-utils';
import type { AbsenceRequest } from '../../lib/absenceRequests';
import { ReasonDialog } from './ReasonDialog';

export type RequestDialog =
  | { kind: 'partial' | 'edit' | 'docs' | 'unapprove'; request: AbsenceRequest }
  | { kind: 'reject'; requests: AbsenceRequest[] }
  | { kind: 'add' | 'bulk' }
  | null;

interface RequestsDialogsProps {
  dialog: RequestDialog;
  holidays: Holiday[];
  onClose: () => void;
  onChanged: () => void;
  onReject: (requests: AbsenceRequest[], reason: string) => Promise<void>;
  onUnapprove: (request: AbsenceRequest, note: string) => Promise<void>;
}

/** As janelas da página de pedidos (só uma aberta de cada vez). */
export const RequestsDialogs: React.FC<RequestsDialogsProps> = ({
  dialog,
  holidays,
  onClose,
  onChanged,
  onReject,
  onUnapprove,
}) => {
  const request = dialog && 'request' in dialog ? dialog.request : null;
  const rejecting = dialog?.kind === 'reject' ? dialog.requests : [];
  const openFor = (kind: string) => (open: boolean) => !open && dialog?.kind === kind && onClose();

  return (
    <>
      <AbsenceApprovalDialog
        open={dialog?.kind === 'partial'}
        onOpenChange={openFor('partial')}
        request={dialog?.kind === 'partial' ? request : null}
        mode="partial"
        onSuccess={onChanged}
      />
      <AbsenceEditDialog
        open={dialog?.kind === 'edit'}
        onOpenChange={openFor('edit')}
        request={dialog?.kind === 'edit' ? request : null}
        onSuccess={onChanged}
      />
      <AbsenceDocumentsDialog
        open={dialog?.kind === 'docs'}
        onOpenChange={openFor('docs')}
        absenceId={dialog?.kind === 'docs' ? (request?.id ?? null) : null}
        employeeName={request?.employee.name}
      />
      <AdminAddAbsenceDialog
        open={dialog?.kind === 'add'}
        onOpenChange={openFor('add')}
        holidays={holidays}
        onSuccess={onChanged}
      />
      <AdminBulkAbsenceDialog
        open={dialog?.kind === 'bulk'}
        onOpenChange={openFor('bulk')}
        holidays={holidays}
        onSuccess={onChanged}
      />
      <ReasonDialog
        open={dialog?.kind === 'reject'}
        title={rejecting.length > 1 ? `Rejeitar ${rejecting.length} pedidos` : 'Rejeitar pedido'}
        description={
          rejecting.length > 1
            ? 'Cada colaborador é avisado da rejeição, com o motivo (se escrever um).'
            : `${rejecting[0]?.employee.name ?? ''} é avisado da rejeição, com o motivo (se escrever um).`
        }
        label="Motivo (opcional)"
        confirmLabel="Rejeitar"
        onClose={onClose}
        onConfirm={reason => onReject(rejecting, reason)}
      />
      <ReasonDialog
        open={dialog?.kind === 'unapprove'}
        title="Desaprovar pedido"
        description={`O pedido de ${request?.employee.name ?? ''} volta a "Pendente" e os dias de férias voltam ao saldo.`}
        label="Nota de desaprovação (opcional)"
        confirmLabel="Desaprovar"
        onClose={onClose}
        onConfirm={note => (request ? onUnapprove(request, note) : Promise.resolve())}
      />
    </>
  );
};
