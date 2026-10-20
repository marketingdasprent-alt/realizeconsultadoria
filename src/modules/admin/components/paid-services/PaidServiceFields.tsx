import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarClock, Globe, Repeat, Wifi } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BILLING_CYCLES, CYCLE_LABELS } from '@/lib/recurring-services';
import { cn } from '@/lib/utils';
import {
  cycleSentence,
  renewalFor,
  type PaidForm,
  type PaidFormErrors,
} from '../../lib/paidServiceForm';
import type { PaidKind, PaidService } from '../../lib/paidServices';

const KINDS: { kind: PaidKind; label: string; icon: typeof Globe }[] = [
  { kind: 'domain', label: 'Domínio', icon: Globe },
  { kind: 'internet', label: 'Internet', icon: Wifi },
  { kind: 'subscription', label: 'Assinatura', icon: Repeat },
];

const INPUT =
  'h-10 w-full rounded-xl bg-white px-3 text-[14px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary';
const NONE = '__none';

const Field: React.FC<{
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, error, className, children }) => (
  <label className={cn('block space-y-1.5', className)}>
    <span className="text-[13px] font-semibold text-rz-ink">{label}</span>
    {children}
    {error && <span className="block text-[12px] text-destructive">{error}</span>}
  </label>
);

interface PaidServiceFieldsProps {
  form: PaidForm;
  errors: PaidFormErrors;
  existing: PaidService | null;
  companies: { id: string; name: string }[];
  update: (patch: Partial<PaidForm>) => void;
}

/** Campos da janela de serviço pago, conforme o tipo. */
export const PaidServiceFields: React.FC<PaidServiceFieldsProps> = ({
  form,
  errors,
  existing,
  companies,
  update,
}) => {
  const domain = form.kind === 'domain';
  const renewal = form.startDate ? renewalFor(form, existing).renewalDate : null;
  // Domínios e serviços estão em tabelas diferentes: ao editar não se troca entre eles.
  const lockedKind = (kind: PaidKind) =>
    !!existing && (kind === 'domain') !== (existing.kind === 'domain');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo">
        {KINDS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={form.kind === kind}
            disabled={lockedKind(kind)}
            onClick={() => update({ kind, ...(kind === 'domain' ? { cycle: 'yearly' } : {}) })}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-2xl text-[13.5px] font-semibold ring-1 transition-colors disabled:opacity-40',
              form.kind === kind
                ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary'
                : 'bg-white text-rz-ink ring-rz-line hover:bg-rz-canvas'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <Field label={domain ? 'Domínio *' : 'Nome *'} error={errors.name}>
        <input
          className={INPUT}
          value={form.name}
          onChange={e => update({ name: e.target.value })}
          placeholder={domain ? 'exemplo.pt' : 'Ex.: Microsoft 365, NOS Fibra'}
        />
      </Field>

      {!domain && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fornecedor">
            <input
              className={INPUT}
              value={form.provider}
              onChange={e => update({ provider: e.target.value })}
              placeholder="Ex.: Microsoft"
            />
          </Field>
          <Field label="Empresa">
            <Select
              value={form.companyId || NONE}
              onValueChange={value => update({ companyId: value === NONE ? '' : value })}
            >
              <SelectTrigger className="h-10 rounded-xl border-rz-line">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem empresa</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
        <Field label="Valor (€) *" error={errors.amount}>
          <input
            className={INPUT}
            inputMode="decimal"
            value={form.amount}
            onChange={e => update({ amount: e.target.value })}
            placeholder="0,00"
          />
        </Field>
        <Field label="Ciclo *">
          <div className="flex h-10 gap-1 rounded-xl bg-rz-canvas p-1 ring-1 ring-rz-line">
            {BILLING_CYCLES.map(cycle => (
              <button
                key={cycle}
                type="button"
                disabled={domain && cycle !== 'yearly'}
                onClick={() => update({ cycle })}
                className={cn(
                  'flex-1 rounded-lg text-[12.5px] font-semibold disabled:opacity-30',
                  form.cycle === cycle
                    ? 'bg-white text-rz-ink shadow-sm'
                    : 'text-rz-muted hover:text-rz-ink'
                )}
              >
                {CYCLE_LABELS[cycle]}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-[180px_minmax(0,1fr)] items-end gap-3">
        <Field label="Data de início *" error={errors.startDate}>
          <input
            type="date"
            className={INPUT}
            value={form.startDate}
            onChange={e => update({ startDate: e.target.value })}
          />
        </Field>
        <div className="flex h-10 items-center gap-2 rounded-xl bg-rz-primary-soft px-3 text-[13px] text-rz-ink">
          <CalendarClock className="h-4 w-4 shrink-0 text-rz-primary" />
          <span className="truncate">
            {renewal
              ? `Próxima: ${format(parseISO(renewal), 'd MMM yyyy', { locale: pt })} · ${cycleSentence(domain ? 'yearly' : form.cycle, form.startDate)}`
              : 'A próxima renovação calcula-se sozinha'}
          </span>
        </div>
      </div>

      {form.kind === 'internet' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Local da instalação">
            <input
              className={INPUT}
              value={form.location}
              onChange={e => update({ location: e.target.value })}
              placeholder="Ex.: Escritório Leiria"
            />
          </Field>
          <Field label="Fidelização até">
            <input
              type="date"
              className={INPUT}
              value={form.fidelityEnd}
              onChange={e => update({ fidelityEnd: e.target.value })}
            />
          </Field>
        </div>
      )}

      {!domain && (
        <Field label="Notas">
          <textarea
            rows={2}
            className="w-full rounded-xl bg-white px-3 py-2 text-[14px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary"
            value={form.notes}
            onChange={e => update({ notes: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
};
