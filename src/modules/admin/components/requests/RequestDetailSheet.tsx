import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, CalendarRange, Paperclip, Pencil, Printer, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { trainingModeLabels } from '@/lib/absence-types';
import { isApprovedStatus, type AbsenceRequest } from '../../lib/absenceRequests';
import { RequestContextInfo } from './RequestContextInfo';
import { RequestPeriodsList } from './RequestPeriodsList';
import { Note, PersonAvatar, StatusPill, TypeChip } from './requestStyles';

export type SheetAction =
  | 'approve'
  | 'partial'
  | 'reject'
  | 'edit'
  | 'unapprove'
  | 'print'
  | 'docs';

interface RequestDetailSheetProps {
  request: AbsenceRequest | null;
  avatarUrl: string | null;
  onClose: () => void;
  onAction: (action: SheetAction, request: AbsenceRequest) => void;
}

/** Tudo sobre um pedido e as decisões, num painel lateral. */
export const RequestDetailSheet: React.FC<RequestDetailSheetProps> = ({
  request,
  avatarUrl,
  onClose,
  onAction,
}) => {
  if (!request) return null;
  const pending = request.status === 'pending';
  const approved = isApprovedStatus(request.status);
  const act = (action: SheetAction) => onAction(action, request);
  const role = [request.employee.position, request.employee.department].filter(Boolean).join(' · ');

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 font-jakarta sm:max-w-md">
        <SheetHeader className="space-y-3 border-b border-rz-line p-5 text-left">
          <div className="flex items-center gap-3">
            <PersonAvatar name={request.employee.name} url={avatarUrl} size="lg" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-[19px] font-extrabold">
                {request.employee.name}
              </SheetTitle>
              <p className="truncate text-[13px] text-rz-muted">
                {role ? `${role} · ` : ''}
                {request.company.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip type={request.absence_type} />
            {request.absence_type === 'training' && request.training_mode && (
              <span className="text-[12.5px] text-rz-muted">
                {trainingModeLabels[request.training_mode] ?? request.training_mode}
              </span>
            )}
            <StatusPill status={request.status} />
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <RequestPeriodsList request={request} />
          {request.notes && <Note title="Nota do colaborador">{request.notes}</Note>}
          {request.rejection_reason && (
            <Note
              title={request.status === 'rejected' ? 'Motivo da rejeição' : 'Nota de desaprovação'}
              tone={request.status === 'rejected' ? 'red' : 'orange'}
            >
              {request.rejection_reason}
            </Note>
          )}
          <RequestContextInfo request={request} />
          {request.document_count > 0 && (
            <Button variant="outline" className="w-full rounded-full" onClick={() => act('docs')}>
              <Paperclip className="h-4 w-4" />
              Ver{' '}
              {request.document_count === 1 ? 'documento' : `${request.document_count} documentos`}
            </Button>
          )}
          <p className="text-[12.5px] text-rz-muted">
            Pedido a{' '}
            {format(parseISO(request.created_at), "d 'de' MMMM yyyy 'às' HH:mm", { locale: pt })}
            {request.approver_name && !pending ? ` · decidido por ${request.approver_name}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-rz-line p-4">
          {pending && (
            <>
              <Button
                className="flex-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => act('approve')}
              >
                <Check className="h-4 w-4" /> Aprovar
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => act('partial')}>
                <CalendarRange className="h-4 w-4" /> Em parte
              </Button>
              <Button
                variant="outline"
                className="rounded-full text-rose-600 hover:text-rose-700"
                onClick={() => act('reject')}
              >
                <X className="h-4 w-4" /> Rejeitar
              </Button>
            </>
          )}
          {approved && (
            <Button variant="outline" className="rounded-full" onClick={() => act('print')}>
              <Printer className="h-4 w-4" /> Comprovativo
            </Button>
          )}
          {(pending || approved) && (
            <Button variant="ghost" className="rounded-full" onClick={() => act('edit')}>
              <Pencil className="h-4 w-4" />
              {approved && request.absence_type === 'vacation' ? 'Remarcar' : 'Editar'}
            </Button>
          )}
          {approved && (
            <Button
              variant="ghost"
              className="rounded-full text-orange-700 hover:text-orange-800"
              onClick={() => act('unapprove')}
            >
              <Undo2 className="h-4 w-4" /> Desaprovar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
