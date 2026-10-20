import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, Globe, Pencil, Repeat, Trash2, Wifi } from 'lucide-react';
import { getFidelityStatus, type StatusTone } from '@/lib/recurring-services';
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

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'bg-rz-canvas text-rz-muted',
  soon: 'bg-amber-100 text-amber-800',
  urgent: 'bg-orange-100 text-orange-800',
  overdue: 'bg-rose-100 text-rose-700',
  ended: 'bg-rz-canvas text-rz-muted',
};

interface PaidServiceRowProps {
  service: PaidService;
  canManage: boolean;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const day = (iso: string) => format(parseISO(iso), 'd MMM yyyy', { locale: pt });

/** Um serviço pago: o quê, de quem, quanto, quando renova e se este período está pago. */
export const PaidServiceRow: React.FC<PaidServiceRowProps> = ({
  service,
  canManage,
  onTogglePaid,
  onEdit,
  onDelete,
}) => {
  const kind = KIND_STYLES[service.kind];
  const Icon = kind.icon;
  const status = paidStatus(service);
  const fidelity = getFidelityStatus(service.fidelityEnd);
  const detail = [service.provider, service.location].filter(Boolean).join(' · ');

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          kind.className
        )}
        title={PAID_KIND_LABELS[service.kind]}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1 basis-40">
        <span className="block truncate text-[14px] font-semibold text-rz-ink">{service.name}</span>
        <span className="block truncate text-[12.5px] text-rz-muted">
          {PAID_KIND_LABELS[service.kind]}
          {detail ? ` · ${detail}` : ''}
          {service.companyName ? ` · ${service.companyName}` : ''}
        </span>
      </span>

      <span className="w-[110px] shrink-0 text-right">
        <span className="block text-[14px] font-semibold tabular-nums">
          {formatEuro(service.amount)}
        </span>
        <span className="block text-[12px] text-rz-muted">
          {service.cycle === 'monthly' ? 'por mês' : 'por ano'}
        </span>
      </span>

      <span className="w-[150px] shrink-0">
        <span className="block text-[13px] font-medium">{day(service.renewalDate)}</span>
        {service.paid ? (
          <span className="text-[12px] text-emerald-700">Período pago</span>
        ) : (
          <span
            className={cn(
              'inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
              TONE_CLASSES[status.tone]
            )}
          >
            {status.label}
          </span>
        )}
        {fidelity && fidelity.tone !== 'ended' && (
          <span className="block text-[11.5px] text-rz-muted">Fidelização: {fidelity.label}</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePaid}
          disabled={!canManage}
          title={service.paid ? 'Desfazer o pagamento' : 'Marcar este período como pago'}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold ring-1 transition-colors disabled:opacity-50',
            service.paid
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
              : 'bg-white text-rz-ink ring-rz-line hover:bg-rz-canvas'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {service.paid ? 'Pago' : 'Marcar pago'}
        </button>
        {canManage && (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${service.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Remover ${service.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </span>
    </li>
  );
};
