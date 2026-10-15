import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AbsenceDocumentsDialog from '@/components/admin/AbsenceDocumentsDialog';
import AbsenceEditDialog from '@/components/admin/AbsenceEditDialog';
import AddDocumentsDialog from '@/components/employee/AddDocumentsDialog';
import EmployeeCalendar from '@/components/employee/EmployeeCalendar';
import { toast } from '@/hooks/use-toast';
import type { DatePeriod } from '@/lib/vacation-utils';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { AbsenceBalanceHero } from '../components/AbsenceBalanceHero';
import { AbsenceRequestItem } from '../components/AbsenceRequestItem';
import { NewAbsenceDialog } from '../components/NewAbsenceDialog';
import { useMyAbsences } from '../hooks/useMyAbsences';
import {
  daysToPeriods,
  filterAbsences,
  REQUEST_FILTERS,
  type AbsenceRow,
  type RequestFilter,
} from '../lib/absenceRules';

type Dialog = { kind: 'edit' | 'attach' | 'docs' | 'cancel'; absence: AbsenceRow } | null;

/** Férias e ausências (briefing §11): saldo, pedidos, calendário e todas as regras de sempre. */
const AbsencesPage: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const absences = useMyAbsences();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [preset, setPreset] = useState<{ absenceType: string; periods: DatePeriod[] } | null>(null);

  // Atalho "Novo pedido" (/colaborador/pedidos?novo=1)
  useEffect(() => {
    if (params.get('novo')) {
      // Dias escolhidos no Calendário (?dias=2026-11-02,2026-11-03,…)
      const days = params.get('dias')?.split(',').filter(Boolean) ?? [];
      setPreset(days.length ? { absenceType: 'vacation', periods: daysToPeriods(days) } : null);
      setIsNewOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const visible = useMemo(
    () => filterAbsences(absences.data?.absences ?? [], filter),
    [absences.data, filter]
  );

  const open = (kind: NonNullable<Dialog>['kind']) => (absence: AbsenceRow) => {
    if (isPreview && kind !== 'cancel') {
      return toast({ title: 'Pré-visualização', description: 'Esta ação usa dados reais.' });
    }
    setDialog({ kind, absence });
  };

  if (absences.isLoading || !absences.data) {
    return <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-rz-primary" />;
  }
  const data = absences.data;

  return (
    <WorkspacePage>
      <h1 className="mb-4 text-[26px] font-extrabold">Férias e ausências</h1>
      <AbsenceBalanceHero
        data={data}
        onNewRequest={() => {
          setPreset(null);
          setIsNewOpen(true);
        }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-3" aria-label="Os meus pedidos">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Os meus pedidos</h2>
          </div>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {REQUEST_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold',
                  filter === option.value
                    ? 'bg-rz-ink text-white'
                    : 'bg-white text-rz-muted ring-1 ring-rz-line'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="rounded-[26px] bg-white p-10 text-center text-rz-muted ring-1 ring-rz-line">
              {data.absences.length === 0
                ? 'Ainda não tem pedidos registados.'
                : 'Sem pedidos neste filtro.'}
            </p>
          ) : (
            visible.map(absence => (
              <AbsenceRequestItem
                key={absence.id}
                absence={absence}
                onReschedule={open('edit')}
                onCancel={open('cancel')}
                onAttach={open('attach')}
                onViewDocuments={open('docs')}
              />
            ))
          )}
        </section>
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-[26px] [&>div]:rounded-[26px] [&>div]:border-0 [&>div]:shadow-rz-soft">
            <EmployeeCalendar
              absences={data.absences as Parameters<typeof EmployeeCalendar>[0]['absences']}
              holidays={data.holidays}
            />
          </div>
        </aside>
      </div>

      <NewAbsenceDialog
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        data={data}
        isSubmitting={absences.isSubmitting}
        onSubmit={absences.submit}
        preset={preset}
      />
      <ConfirmDialog
        open={dialog?.kind === 'cancel'}
        title="Cancelar pedido?"
        description="Esta ação não pode ser desfeita. O pedido será removido permanentemente."
        confirmLabel="Cancelar pedido"
        onConfirm={() => dialog && absences.cancel(dialog.absence.id)}
        onClose={() => setDialog(null)}
      />
      <AbsenceDocumentsDialog
        open={dialog?.kind === 'docs'}
        onOpenChange={value => !value && setDialog(null)}
        absenceId={dialog?.kind === 'docs' ? dialog.absence.id : null}
      />
      <AddDocumentsDialog
        open={dialog?.kind === 'attach'}
        onOpenChange={value => !value && setDialog(null)}
        absenceId={dialog?.kind === 'attach' ? dialog.absence.id : null}
        onSuccess={absences.refresh}
      />
      <AbsenceEditDialog
        open={dialog?.kind === 'edit'}
        onOpenChange={value => !value && setDialog(null)}
        actor="employee"
        request={
          dialog?.kind === 'edit'
            ? {
                id: dialog.absence.id,
                status: dialog.absence.status,
                absence_type: dialog.absence.absence_type,
                notes: dialog.absence.notes,
                employee: { id: user.employeeId, name: user.name, email: user.email },
                company: { id: user.companyId, name: user.companyName ?? '' },
                periods: (dialog.absence.absence_periods ?? []).map(period => ({
                  ...period,
                  period_type: period.period_type ?? undefined,
                })),
              }
            : null
        }
        onSuccess={absences.refresh}
      />
    </WorkspacePage>
  );
};

export default AbsencesPage;
