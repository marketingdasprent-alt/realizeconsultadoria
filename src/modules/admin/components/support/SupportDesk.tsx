import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Headset, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getLogoBase64, getLogoHeaderHtml } from '@/lib/logo-utils';
import { openPrintPreview } from '@/lib/print-preview';
import type { SupportTicket } from '@/hooks/useAdminTickets';
import {
  SUPPORT_KEYS,
  useReplyMarks,
  useSupportRealtime,
} from '../../hooks/useSupportConversation';
import {
  filterTickets,
  isDone,
  ticketActivity,
  ticketPrintHtml,
  type QueueFilter,
} from '../../lib/supportTickets';
import { supportAdminService } from '../../services/supportAdminService';
import { SupportFilters } from './SupportFilters';
import { SupportTicketDetail } from './SupportTicketDetail';
import { SupportTicketList } from './SupportTicketList';

interface SupportDeskProps {
  /** Só os tickets que esta pessoa pode tratar. */
  tickets: SupportTicket[];
  isLoading: boolean;
  refetch: () => unknown;
  updateTicketStatus: (ticketId: string, status: string) => Promise<void>;
  /** Departamentos para o filtro (o filtro só aparece com mais de um). */
  departments: { id: string; name: string }[];
  /** Cabeçalho da página, com o resumo ("N à espera · M por resolver"). */
  renderHeader: (summary: string) => React.ReactNode;
  className?: string;
}

/**
 * Fila de suporte (admin e equipas no Workspace): à esquerda os tickets (à espera de resposta
 * primeiro), à direita o ticket aberto com a conversa. Atualiza sozinha (tempo real).
 */
export const SupportDesk: React.FC<SupportDeskProps> = ({
  tickets,
  isLoading,
  refetch,
  updateTicketStatus,
  departments,
  renderHeader,
  className,
}) => {
  const qc = useQueryClient();
  const marks = useReplyMarks();
  const [params, setParams] = useSearchParams();
  const [queue, setQueue] = useState<QueueFilter>('awaiting');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => void refetch(), [refetch]);
  useSupportRealtime(refresh);

  const repliesByTicket = useMemo(() => {
    const map = new Map<string, typeof marks>();
    for (const mark of marks) map.set(mark.ticket_id, [...(map.get(mark.ticket_id) ?? []), mark]);
    return map;
  }, [marks]);
  const activityOf = useCallback(
    (ticket: SupportTicket) => ticketActivity(ticket, repliesByTicket.get(ticket.id) ?? []),
    [repliesByTicket]
  );

  const filters = { search, priority, departmentId };
  const visible = filterTickets(tickets, { ...filters, queue }, activityOf);
  const counts = {
    awaiting: filterTickets(tickets, { ...filters, queue: 'awaiting' }, activityOf).length,
    active: filterTickets(tickets, { ...filters, queue: 'active' }, activityOf).length,
    done: filterTickets(tickets, { ...filters, queue: 'done' }, activityOf).length,
    all: filterTickets(tickets, { ...filters, queue: 'all' }, activityOf).length,
  };

  const selectedId = params.get('t');
  const selected = tickets.find(ticket => ticket.id === selectedId) ?? null;
  const select = (ticket: SupportTicket | null) =>
    setParams(ticket ? { t: ticket.id } : {}, { replace: true });
  const departmentName = (id: string | null) => departments.find(d => d.id === id)?.name ?? null;

  const changeStatus = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateTicketStatus(selected.id, status);
      toast({ title: 'Estado atualizado', description: 'O colaborador foi avisado.' });
    } catch (error: unknown) {
      toast({
        title: 'O estado não foi atualizado',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const reply = async (message: string, files: File[]) => {
    if (!selected) return false;
    const { error, failed } = await supportAdminService.reply(selected, message, files);
    if (failed.length)
      toast({
        title: 'Alguns anexos não foram enviados',
        description: failed.join(', '),
        variant: 'destructive',
      });
    if (error) {
      toast({ title: 'A resposta não foi enviada', variant: 'destructive' });
      return false;
    }
    void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.replies(selected.id) });
    void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.attachments(selected.id) });
    void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.marks });
    if (selected.status === 'open') refresh();
    return true;
  };

  const print = async (replies: { sender_role: string; message: string; created_at: string }[]) => {
    if (!selected) return;
    const logo = await getLogoBase64();
    const title = `Ticket de suporte — ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: pt })}`;
    openPrintPreview(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket de suporte</title>
<style>@page{size:A4 portrait;margin:1.5cm}body{font-family:Arial,sans-serif;color:#000;margin:0}</style>
</head><body>${getLogoHeaderHtml(logo, title)}${ticketPrintHtml(selected, replies, departmentName(selected.department_id))}</body></html>`,
      'Ticket de suporte'
    );
  };

  return (
    <div className="space-y-5">
      {renderHeader(
        `${counts.awaiting} à espera de resposta · ${tickets.filter(t => !isDone(t.status)).length} por resolver`
      )}
      <section
        className={cn(
          'flex h-[calc(100vh-13rem)] min-h-[520px] overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line',
          className
        )}
      >
        <aside
          className={cn(
            'flex w-full min-w-0 flex-col border-rz-line lg:w-[380px] lg:shrink-0 lg:border-r',
            selected && 'hidden lg:flex'
          )}
        >
          <SupportFilters
            queue={queue}
            onQueue={setQueue}
            counts={counts}
            search={search}
            onSearch={setSearch}
            priority={priority}
            onPriority={setPriority}
            departmentId={departmentId}
            onDepartment={setDepartmentId}
            departments={departments}
          />
          <div className="rz-scroll min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-rz-primary" />
            ) : (
              <SupportTicketList
                tickets={visible}
                activityOf={activityOf}
                selectedId={selectedId}
                onSelect={select}
                departmentName={departmentName}
              />
            )}
          </div>
        </aside>
        <div className={cn('min-w-0 flex-1 flex-col', selected ? 'flex' : 'hidden lg:flex')}>
          {selected ? (
            <SupportTicketDetail
              key={selected.id}
              ticket={selected}
              departmentName={departmentName(selected.department_id)}
              onBack={() => select(null)}
              onStatus={status => void changeStatus(status)}
              onReply={reply}
              onPrint={replies => void print(replies)}
              busy={busy}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-rz-muted">
              <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-rz-primary-soft text-rz-primary">
                <Headset className="h-8 w-8" />
              </span>
              <p className="text-sm">Escolha um ticket para ver a conversa e responder.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
