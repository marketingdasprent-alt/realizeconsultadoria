import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Headset, Loader2, Plus } from 'lucide-react';
import NewTicketDialog from '@/components/employee/NewTicketDialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { getModule } from '@/modules/workspace/lib/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { TicketListItem } from '../components/TicketListItem';
import { TicketThread } from '../components/TicketThread';
import { TICKETS_KEY, useMyTickets } from '../hooks/useMyTickets';
import { countTickets, filterTickets, TICKET_FILTERS, type TicketFilter } from '../lib/ticketRules';

/**
 * Tickets (briefing §16): lista à esquerda e a conversa à direita (no telemóvel, uma de cada
 * vez). O ticket aberto fica no endereço (?t=id).
 */
const SupportPage: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const qc = useQueryClient();
  const { tickets, attachments, isLoading } = useMyTickets();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const activeId = params.get('t');
  const active = tickets.find(t => t.id === activeId) ?? null;
  const counts = useMemo(() => countTickets(tickets), [tickets]);
  const visible = useMemo(() => filterTickets(tickets, filter), [tickets, filter]);

  // Atalho "Pedir ajuda" (/colaborador/tickets?novo=1)
  useEffect(() => {
    if (params.get('novo')) {
      setIsNewOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const newTicket = () =>
    isPreview
      ? toast({ title: 'Pré-visualização', description: 'Criar um ticket usa dados reais.' })
      : setIsNewOpen(true);

  return (
    <div className="flex h-full">
      <section
        className={cn(
          'flex w-full min-h-0 flex-col border-r border-rz-line bg-white md:w-[380px]',
          active && 'hidden md:flex'
        )}
        aria-label="Os meus tickets"
      >
        <div className="space-y-3 px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2.5 text-[22px] font-extrabold">
              <ModuleIcon module={getModule('tickets')} size="sm" /> Tickets
            </h1>
            <button
              type="button"
              onClick={newTicket}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Novo pedido
            </button>
          </div>
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
            {TICKET_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold',
                  filter === option.value ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted'
                )}
              >
                {option.label} <span className="opacity-60">{counts[option.value]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rz-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-28 md:pb-3">
          {isLoading ? (
            <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-rz-primary" />
          ) : visible.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-rz-muted">
              {filter === 'all'
                ? 'Ainda não tem tickets de suporte.'
                : 'Nenhum ticket nesta categoria.'}
            </p>
          ) : (
            visible.map(ticket => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                attachmentCount={attachments[ticket.id]?.length ?? 0}
                isActive={ticket.id === activeId}
                onSelect={id => setParams({ t: id })}
              />
            ))
          )}
        </div>
      </section>

      <div className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
        {active ? (
          <TicketThread
            ticket={active}
            attachments={attachments[active.id] ?? []}
            onBack={() => setParams({})}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-cyan-100 to-violet-100">
              <Headset className="h-9 w-9 text-rz-primary" />
            </span>
            <h2 className="mt-5 text-xl font-extrabold">Precisa de ajuda dos RH?</h2>
            <p className="mt-1.5 max-w-sm text-sm text-rz-muted">
              Escolha um ticket para ver a conversa, ou abra um novo pedido.
            </p>
          </div>
        )}
      </div>

      {!isPreview && (
        <NewTicketDialog
          open={isNewOpen}
          onOpenChange={setIsNewOpen}
          employeeId={user.employeeId}
          companyId={user.companyId}
          employeeName={user.name}
          employeeEmail={user.email}
          companyName={user.companyName ?? ''}
          onSuccess={() => qc.invalidateQueries({ queryKey: TICKETS_KEY })}
        />
      )}
    </div>
  );
};

export default SupportPage;
