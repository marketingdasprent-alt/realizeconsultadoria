import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { usePaidServices } from '../../hooks/usePaidServices';
import type { PaidForm } from '../../lib/paidServiceForm';
import {
  filterPaid,
  summarizePaid,
  type PaidFilters,
  type PaidService,
} from '../../lib/paidServices';
import { paidServicesService } from '../../services/paidServicesService';
import { PaidServiceDialog, type PaidDialogTarget } from './PaidServiceDialog';
import { PAID_GRID, PaidServiceRow } from './PaidServiceRow';
import { PaidServicesSummary } from './PaidServicesSummary';
import { PaidServicesToolbar } from './PaidServicesToolbar';

interface PaidServicesTabProps {
  canManage: boolean;
  companies: { id: string; name: string }[];
}

const HEADER = ['Serviço', 'Empresa', 'Valor', 'Renova a', 'Estado', ''];

/** Acessos → Serviços pagos: domínios, internet e assinaturas numa só lista. */
export const PaidServicesTab: React.FC<PaidServicesTabProps> = ({ canManage, companies }) => {
  const { toast } = useToast();
  const data = usePaidServices();
  const [filters, setFilters] = useState<PaidFilters>({
    kind: 'all',
    companyId: 'all',
    search: '',
  });
  const [dialog, setDialog] = useState<PaidDialogTarget>(null);
  const [toDelete, setToDelete] = useState<PaidService | null>(null);

  const list = useMemo(() => filterPaid(data.services, filters), [data.services, filters]);
  const summary = useMemo(() => summarizePaid(list), [list]);

  const togglePaid = async (service: PaidService) => {
    const { next, error } = await data.togglePaid(service);
    toast(
      error
        ? { title: 'Erro ao atualizar o pagamento', variant: 'destructive' }
        : {
            title: service.paid
              ? 'Pagamento anulado'
              : `Pago — próxima renovação a ${format(parseISO(next.renewalDate), 'dd/MM/yyyy')}`,
          }
    );
  };

  const save = async (form: PaidForm, existing: PaidService | null) => {
    const { error } = await paidServicesService.save(form, existing);
    toast(
      error ? { title: 'Erro ao guardar', variant: 'destructive' } : { title: 'Serviço guardado' }
    );
    void data.refresh();
    return !error;
  };

  return (
    <div className="space-y-4">
      <PaidServicesSummary summary={summary} />

      <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
        <PaidServicesToolbar
          filters={filters}
          companies={companies}
          canManage={canManage}
          onChange={patch => setFilters(current => ({ ...current, ...patch }))}
          onAdd={kind => setDialog({ kind })}
        />
        <div
          className={`hidden border-b border-rz-line bg-rz-canvas/50 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-rz-muted ${PAID_GRID}`}
        >
          {HEADER.map((title, index) => (
            <span key={index} className={index === 2 ? 'text-right' : undefined}>
              {title}
            </span>
          ))}
        </div>
        {data.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map(key => (
              <div key={key} className="h-12 animate-pulse rounded-xl bg-rz-canvas" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-6 py-12 text-center text-[14px] text-rz-muted">
            {data.isError
              ? 'Não foi possível carregar os serviços.'
              : 'Sem serviços com estes filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-rz-line">
            {list.map(service => (
              <PaidServiceRow
                key={service.key}
                service={service}
                canManage={canManage}
                onTogglePaid={() => void togglePaid(service)}
                onEdit={() => setDialog({ service })}
                onDelete={() => setToDelete(service)}
              />
            ))}
          </ul>
        )}
      </section>

      <PaidServiceDialog
        target={dialog}
        companies={companies}
        onClose={() => setDialog(null)}
        onSave={save}
      />
      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Remover serviço"
        description="Deixa de aparecer na lista e nos lembretes de renovação."
        itemName={toDelete?.name}
        onConfirm={async () => {
          if (!toDelete) return;
          const ok = await data.remove(toDelete);
          toast(
            ok
              ? { title: 'Serviço removido' }
              : { title: 'Erro ao remover', variant: 'destructive' }
          );
          setToDelete(null);
        }}
      />
    </div>
  );
};
