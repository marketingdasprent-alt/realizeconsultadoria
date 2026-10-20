import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Globe, Plus, Repeat, Search, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { DomainModal } from '@/components/admin/domains/DomainModal';
import { ServiceModal } from '@/components/admin/services/ServiceModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePaidServices } from '../../hooks/usePaidServices';
import {
  filterPaid,
  summarizePaid,
  type PaidFilters,
  type PaidKind,
  type PaidService,
} from '../../lib/paidServices';
import { PaidServiceRow } from './PaidServiceRow';
import { PaidServicesSummary } from './PaidServicesSummary';
import { editorFor, newEditor, type PaidEditor } from './paidServiceForms';

const KINDS: { value: PaidFilters['kind']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'domain', label: 'Domínios' },
  { value: 'internet', label: 'Internet' },
  { value: 'subscription', label: 'Assinaturas' },
];

const ADD: { kind: PaidKind; label: string; icon: typeof Globe }[] = [
  { kind: 'domain', label: 'Domínio', icon: Globe },
  { kind: 'internet', label: 'Internet', icon: Wifi },
  { kind: 'subscription', label: 'Assinatura', icon: Repeat },
];

interface PaidServicesTabProps {
  canManage: boolean;
  companies: { id: string; name: string }[];
}

/** Acessos → Serviços pagos: domínios, internet e assinaturas numa só lista. */
export const PaidServicesTab: React.FC<PaidServicesTabProps> = ({ canManage, companies }) => {
  const { toast } = useToast();
  const data = usePaidServices();
  const [filters, setFilters] = useState<PaidFilters>({
    kind: 'all',
    companyId: 'all',
    search: '',
  });
  const [editor, setEditor] = useState<PaidEditor>(null);
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

  return (
    <div className="space-y-4">
      <PaidServicesSummary summary={summary} count={list.length} />

      <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
        <div className="flex flex-wrap items-center gap-2 border-b border-rz-line p-3 sm:p-4">
          <div
            className="flex gap-1 rounded-full bg-rz-canvas p-1 ring-1 ring-rz-line"
            role="tablist"
          >
            {KINDS.map(option => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filters.kind === option.value}
                onClick={() => setFilters(f => ({ ...f, kind: option.value }))}
                className={cn(
                  'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                  filters.kind === option.value
                    ? 'bg-white text-rz-ink shadow-sm'
                    : 'text-rz-muted hover:text-rz-ink'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
            <Input
              type="search"
              placeholder="Pesquisar serviço…"
              value={filters.search}
              onChange={event => setFilters(f => ({ ...f, search: event.target.value }))}
              className="h-9 rounded-full border-rz-line pl-9 text-[13px]"
            />
          </div>
          <Select
            value={filters.companyId}
            onValueChange={companyId => setFilters(f => ({ ...f, companyId }))}
          >
            <SelectTrigger
              className="h-9 w-full rounded-full border-rz-line text-[13px] sm:w-[200px]"
              aria-label="Empresa"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gold" className="ml-auto rounded-full">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ADD.map(({ kind, label, icon: Icon }) => (
                  <DropdownMenuItem key={kind} onClick={() => setEditor(newEditor(kind))}>
                    <Icon className="mr-2 h-4 w-4" /> {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
                onEdit={() => setEditor(editorFor(service))}
                onDelete={() => setToDelete(service)}
              />
            ))}
          </ul>
        )}
      </section>

      <DomainModal
        open={editor?.kind === 'domain'}
        onOpenChange={open => !open && setEditor(null)}
        domain={editor?.kind === 'domain' ? editor.domain : null}
        onSave={() => void data.refresh()}
      />
      <ServiceModal
        open={editor?.kind === 'service'}
        onOpenChange={open => !open && setEditor(null)}
        service={editor?.kind === 'service' ? editor.service : null}
        companies={companies}
        onSave={() => void data.refresh()}
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
