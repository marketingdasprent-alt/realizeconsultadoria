import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, Globe, ListPlus, Pencil, Repeat, Trash2, Wifi } from 'lucide-react';
import { CYCLE_PER, getFidelityStatus } from '@/lib/recurring-services';
import { cn } from '@/lib/utils';
import {
  PAID_KIND_LABELS,
  formatEuro,
  paidStatus,
  type PaidKind,
  type PaidService,
} from '../../lib/paidServices';

const KIND_STYLES: Record<PaidKind, { icon: typeof Globe; className: string }> = {
  domain: { icon: Globe, className: 'bg-sky-100 text-sky-700' },
  internet: { icon: Wifi, className: 'bg-violet-100 text-violet-700' },
  subscription: { icon: Repeat, className: 'bg-amber-100 text-amber-700' },
};

/** Colunas da lista (o cabeçalho usa as mesmas, para alinhar). */
export const PAID_GRID =
  'xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_120px_120px_150px_232px] xl:items-center xl:gap-4';

/**
 * Estado só pela data: atrasado, a vencer (7 dias) ou em dia. "Pago" não é um estado à parte
 * — depois de pagar, a renovação avança e fica em dia.
 */
const statusOf = (service: PaidService) => {
  const status = paidStatus(service);
  if (status.tone === 'overdue') {
    const days = Math.abs(status.daysUntil);
    return {
      due: true,
      label: `Atrasado ${days} ${days === 1 ? 'dia' : 'dias'}`,
      className: 'bg-rose-50 text-rose-700',
    };
  }
  if (status.tone === 'urgent')
    return {
      due: true,
      label: status.daysUntil === 0 ? 'Vence hoje' : `Vence em ${status.daysUntil} dias`,
      className: 'bg-amber-50 text-amber-800',
    };
  return { due: false, label: 'Em dia', className: 'bg-emerald-50 text-emerald-700' };
};

const ICON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink';

interface PaidServiceRowProps {
  service: PaidService;
  canManage: boolean;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Criar uma tarefa para tratar deste serviço (responsável e participantes). */
  onCreateTask: () => void;
}

/** Uma linha: o quê, de que empresa, quanto, quando renova, o estado e as ações. */
export const PaidServiceRow: React.FC<PaidServiceRowProps> = ({
  service,
  canManage,
  onTogglePaid,
  onEdit,
  onDelete,
  onCreateTask,
}) => {
  const kind = KIND_STYLES[service.kind];
  const Icon = kind.icon;
  const status = statusOf(service);
  const fidelity = getFidelityStatus(service.fidelityEnd);

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', PAID_GRID)}>
      <span className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            kind.className
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span
            className="block truncate text-[14px] font-semibold text-rz-ink"
            title={service.name}
          >
            {service.name}
          </span>
          <span className="block truncate text-[12.5px] text-rz-muted">
            {[PAID_KIND_LABELS[service.kind], service.provider, service.location]
              .filter(Boolean)
              .join(' · ')}
            {service.companyName && <span className="xl:hidden"> · {service.companyName}</span>}
          </span>
        </span>
      </span>

      <span
        className="hidden truncate text-[13px] text-rz-muted xl:block"
        title={service.companyName ?? ''}
      >
        {service.companyName ?? '—'}
      </span>

      <span className="text-right">
        <span className="block text-[14px] font-semibold tabular-nums">
          {formatEuro(service.amount)}
        </span>
        <span className="block text-[12px] text-rz-muted">{CYCLE_PER[service.cycle]}</span>
      </span>

      <span>
        <span className="block text-[13.5px] font-medium">
          {format(parseISO(service.renewalDate), 'd MMM yyyy', { locale: pt })}
        </span>
        {fidelity && fidelity.tone !== 'ended' && (
          <span className="block text-[11.5px] text-rz-muted">
            Fideliz. {fidelity.label.toLowerCase()}
          </span>
        )}
      </span>

      <span>
        <span
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
            status.className
          )}
        >
          {status.label}
        </span>
      </span>

      <span className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onCreateTask}
          aria-label={`Criar tarefa para ${service.name}`}
          title="Criar tarefa (responsável e participantes)"
          className={ICON}
        >
          <ListPlus className="h-4 w-4" />
        </button>
        {canManage && (
          <>
            <button
              type="button"
              onClick={onTogglePaid}
              title={
                service.paid
                  ? 'Desfazer o pagamento deste período'
                  : 'Marcar este período como pago'
              }
              className={cn(
                'inline-flex h-8 w-[112px] items-center justify-center gap-1 rounded-full text-[12.5px] font-semibold ring-1 transition-colors',
                service.paid
                  ? 'bg-transparent text-rz-muted ring-transparent hover:bg-rz-canvas hover:text-rz-ink'
                  : status.due
                    ? 'bg-rz-primary text-white ring-rz-primary hover:bg-rz-primary/90'
                    : 'bg-white text-rz-primary ring-rz-line hover:bg-rz-primary-soft'
              )}
            >
              {service.paid ? (
                'Desfazer'
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Marcar pago
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${service.name}`}
              className={ICON}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Remover ${service.name}`}
              className={cn(ICON, 'hover:bg-rose-50 hover:text-rose-600')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </span>
    </li>
  );
};
