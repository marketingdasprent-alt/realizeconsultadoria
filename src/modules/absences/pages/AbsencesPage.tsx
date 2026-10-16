import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AbsenceDocumentsDialog from '@/components/admin/AbsenceDocumentsDialog';
import AddDocumentsDialog from '@/components/employee/AddDocumentsDialog';
import type { DatePeriod } from '@/lib/vacation-utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { AbsenceBalanceHero } from '../components/AbsenceBalanceHero';
import { EditPeriodDialog } from '../components/EditPeriodDialog';
import { NewAbsenceDialog } from '../components/NewAbsenceDialog';
import { PeriodsList } from '../components/PeriodsList';
import { YearStrip } from '../components/YearStrip';
import { useMyAbsences } from '../hooks/useMyAbsences';
import { daysToPeriods } from '../lib/absenceRules';
import { buildPeriodItems, groupPeriodItems, type PeriodItem } from '../lib/periodItems';

type Dialog = { kind: 'edit' | 'attach' | 'docs' | 'cancel'; item: PeriodItem } | null;

/**
 * Férias e ausências (briefing §11): o saldo e, por baixo, os períodos (não os pedidos):
 * a faixa do ano, o que precisa de atenção, os próximos e o histórico. Cada período edita-se
 * à parte; as regras de negócio são as de sempre.
 */
const AbsencesPage: React.FC = () => {
  const absences = useMyAbsences();
  const [params, setParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
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

  const items = useMemo(() => buildPeriodItems(absences.data?.absences ?? []), [absences.data]);
  const groups = useMemo(() => groupPeriodItems(items), [items]);

  if (absences.isLoading || !absences.data) {
    return <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-rz-primary" />;
  }
  const data = absences.data;

  // Tocar num bloco da faixa leva à linha (e destaca-a).
  const select = (id: string) => {
    setPinnedId(id);
    document
      .getElementById(`periodo-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const open = (kind: NonNullable<Dialog>['kind']) => (item: PeriodItem) =>
    setDialog({ kind, item });
  const closeDialog = () => setDialog(null);

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

      <div className="mt-6">
        <YearStrip
          items={items}
          year={new Date().getFullYear()}
          highlightId={highlightId ?? pinnedId}
          onSelect={select}
        />
        <PeriodsList
          groups={groups}
          highlightId={highlightId ?? pinnedId}
          onHover={setHighlightId}
          onEdit={open('edit')}
          onCancel={open('cancel')}
          onAttach={open('attach')}
          onViewDocuments={open('docs')}
          onPickNewDates={item => {
            setPreset({ absenceType: item.absenceType, periods: [] });
            setIsNewOpen(true);
          }}
        />
      </div>

      <NewAbsenceDialog
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        data={data}
        isSubmitting={absences.isSubmitting}
        onSubmit={absences.submit}
        preset={preset}
      />
      {dialog?.kind === 'edit' && (
        <EditPeriodDialog
          key={dialog.item.id}
          item={dialog.item}
          holidays={data.holidays}
          balance={data.balance}
          scheduledByEmployee={data.scheduledByEmployee}
          onClose={closeDialog}
          onSave={absences.editPeriod}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === 'cancel'}
        title={
          dialog?.item.status === 'rejected' ? 'Remover este período?' : 'Cancelar este período?'
        }
        description={
          dialog?.item.siblings === 1
            ? 'Este era o único período do pedido, por isso o pedido todo é removido. Esta ação não pode ser desfeita.'
            : 'Só este período é removido; os outros do pedido ficam como estão. Esta ação não pode ser desfeita.'
        }
        confirmLabel={dialog?.item.status === 'rejected' ? 'Remover' : 'Cancelar período'}
        onConfirm={() => dialog && absences.cancelPeriod(dialog.item)}
        onClose={closeDialog}
      />
      <AbsenceDocumentsDialog
        open={dialog?.kind === 'docs'}
        onOpenChange={value => !value && closeDialog()}
        absenceId={dialog?.kind === 'docs' ? dialog.item.absenceId : null}
      />
      <AddDocumentsDialog
        open={dialog?.kind === 'attach'}
        onOpenChange={value => !value && closeDialog()}
        absenceId={dialog?.kind === 'attach' ? dialog.item.absenceId : null}
        onSuccess={absences.refresh}
      />
    </WorkspacePage>
  );
};

export default AbsencesPage;
