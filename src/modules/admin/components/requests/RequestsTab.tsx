import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAbsenceRequests } from '../../hooks/useAbsenceRequests';
import { useEmployeeAvatars } from '../../hooks/useEmployeeAvatars';
import { useRequestDecisions } from '../../hooks/useRequestDecisions';
import {
  STATUS_FILTERS,
  filterRequests,
  statusCounts,
  toStatusFilter,
  type AbsenceRequest,
  type RequestFilters,
} from '../../lib/absenceRequests';
import { printAbsenceReceipt, printRequestsReport } from '../../lib/requestPrint';
import { RequestDetailSheet, type SheetAction } from './RequestDetailSheet';
import { RequestsActions } from './RequestsActions';
import { RequestsDialogs, type RequestDialog } from './RequestsDialogs';
import { RequestsFilters } from './RequestsFilters';
import { RequestsList } from './RequestsList';

const EMPTY: Record<string, string> = {
  pending: 'Nada por aprovar.',
  approved: 'Sem pedidos aprovados com estes filtros.',
  rejected: 'Sem pedidos rejeitados com estes filtros.',
  all: 'Sem pedidos com estes filtros.',
};

/** Férias e Ausências → Pedidos: caixa de entrada compacta, com o pedido aberto ao lado. */
const RequestsTab: React.FC<{ tabs: React.ReactNode }> = ({ tabs }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const data = useAbsenceRequests();
  const decisions = useRequestDecisions(data);
  const avatarFor = useEmployeeAvatars();
  const [others, setOthers] = useState({ search: '', type: 'all', companyId: 'all' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RequestDialog>(null);

  const status = toStatusFilter(searchParams.get('status'));
  const filters: RequestFilters = useMemo(() => ({ status, ...others }), [status, others]);
  const list = useMemo(() => filterRequests(data.requests, filters), [data.requests, filters]);
  const counts = useMemo(() => statusCounts(data.requests, filters), [data.requests, filters]);
  const companies = useMemo(
    () =>
      [
        ...new Map(data.requests.map(request => [request.company.id, request.company])).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [data.requests]
  );
  const openRequest = data.requests.find(request => request.id === openId) ?? null;

  const changeFilters = (patch: Partial<RequestFilters>) => {
    const { status, ...rest } = patch;
    if (status) {
      const next = new URLSearchParams(searchParams);
      next.set('status', status);
      setSearchParams(next, { replace: true });
    }
    setOthers(current => ({ ...current, ...rest }));
    setSelected(new Set());
  };

  const unselect = (requests: AbsenceRequest[]) =>
    setSelected(current => {
      const next = new Set(current);
      requests.forEach(request => next.delete(request.id));
      return next;
    });

  const approve = (requests: AbsenceRequest[]) => {
    unselect(requests);
    void decisions.approve(requests);
  };

  const reject = (requests: AbsenceRequest[], reason: string) => {
    unselect(requests);
    return decisions.reject(requests, reason);
  };

  const onSheetAction = (action: SheetAction, request: AbsenceRequest) => {
    if (action === 'approve') approve([request]);
    else if (action === 'reject') setDialog({ kind: 'reject', requests: [request] });
    else if (action === 'print') void printAbsenceReceipt(request);
    else setDialog({ kind: action, request });
  };

  const print = async (mode: 'full' | 'saldo') => {
    const statusLabel = STATUS_FILTERS.find(option => option.value === filters.status)!.label;
    const problem = await printRequestsReport(list, {
      mode,
      statusLabel,
      searchTerm: filters.search,
    });
    if (problem)
      toast({ title: 'Nada para imprimir', description: problem, variant: 'destructive' });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs}
        <RequestsActions
          canPrint={list.length > 0}
          isFetching={data.isFetching}
          onAdd={() => setDialog({ kind: 'add' })}
          onBulk={() => setDialog({ kind: 'bulk' })}
          onPrint={print}
          onRefresh={() => void data.refresh()}
        />
      </div>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
        <RequestsFilters
          filters={filters}
          counts={counts}
          companies={companies}
          onChange={changeFilters}
        />
        <RequestsList
          requests={list}
          isLoading={data.isLoading}
          emptyText={data.isError ? 'Não foi possível carregar os pedidos.' : EMPTY[filters.status]}
          selected={selected}
          avatarFor={avatarFor}
          onSelect={setSelected}
          onOpen={request => setOpenId(request.id)}
          onApprove={approve}
          onReject={requests => setDialog({ kind: 'reject', requests })}
        />
      </section>

      <RequestDetailSheet
        request={openRequest}
        avatarUrl={avatarFor(openRequest?.employee.user_id ?? null)}
        onClose={() => setOpenId(null)}
        onAction={onSheetAction}
      />
      <RequestsDialogs
        dialog={dialog}
        holidays={data.holidays}
        onClose={() => setDialog(null)}
        onChanged={() => void data.refresh()}
        onReject={reject}
        onUnapprove={decisions.unapprove}
      />
    </>
  );
};

export default RequestsTab;
