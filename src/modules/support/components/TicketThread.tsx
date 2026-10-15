import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ArrowLeft, Loader2, Lock, SendHorizontal, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTicketThread } from '../hooks/useMyTickets';
import { isTicketClosed, type SupportTicket, type TicketAttachment } from '../lib/ticketRules';
import { TicketAttachmentChip } from './TicketAttachmentChip';
import { TicketBadges } from './TicketBadges';

interface TicketThreadProps {
  ticket: SupportTicket;
  attachments: TicketAttachment[];
  onBack: () => void;
}

const Bubble: React.FC<{ mine: boolean; at: string; children: React.ReactNode }> = ({
  mine,
  at,
  children,
}) => (
  <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
    {!mine && (
      <span className="mb-1 ml-3 inline-flex items-center gap-1 text-xs font-bold text-rz-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> Recursos Humanos
      </span>
    )}
    <div
      className={cn(
        'max-w-[min(34rem,85%)] rounded-[22px] px-4 py-2.5 text-[14.5px] leading-relaxed shadow-sm',
        mine
          ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
          : 'rounded-bl-md bg-white ring-1 ring-rz-line'
      )}
    >
      {children}
      <span
        className={cn(
          'mt-1 block text-right text-[11px]',
          mine ? 'text-white/70' : 'text-rz-muted'
        )}
      >
        {format(new Date(at), "d MMM 'às' HH:mm", { locale: pt })}
      </span>
    </div>
  </div>
);

/** Conversa de um ticket: pedido original, anexos, respostas e caixa de resposta. */
export const TicketThread: React.FC<TicketThreadProps> = ({ ticket, attachments, onBack }) => {
  const { replies, isLoading, isSending, reply } = useTicketThread(ticket);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const closed = isTicketClosed(ticket);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [replies.length, ticket.id]);

  const send = async () => {
    if (await reply(text)) setText('');
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={ticket.subject}>
      <header className="flex items-start gap-3 border-b border-rz-line bg-white/80 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas md:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">{ticket.subject}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-rz-muted">
            <TicketBadges status={ticket.status} priority={ticket.priority} />
            {format(new Date(ticket.created_at), "d 'de' MMMM yyyy 'às' HH:mm", { locale: pt })}
          </div>
        </div>
      </header>

      <div className="rz-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-6">
        <Bubble mine at={ticket.created_at}>
          <span className="whitespace-pre-wrap">{ticket.message}</span>
        </Bubble>
        {attachments.length > 0 && (
          <div className="ml-auto w-full max-w-sm space-y-1.5">
            {attachments.map(att => (
              <TicketAttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}
        {ticket.admin_notes && (
          <Bubble mine={false} at={ticket.created_at}>
            {ticket.admin_notes}
          </Bubble>
        )}
        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />}
        {replies.map(r => (
          <Bubble key={r.id} mine={r.sender_role === 'employee'} at={r.created_at}>
            <span className="whitespace-pre-wrap">{r.message}</span>
          </Bubble>
        ))}
        <div ref={endRef} />
      </div>

      <div className="px-3 pb-24 pt-2 md:px-5 md:pb-5">
        {closed ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-rz-canvas px-4 py-3 text-[13.5px] text-rz-muted">
            <Lock className="h-4 w-4" /> Este ticket está encerrado. Para outro assunto, abra um
            novo pedido.
          </p>
        ) : (
          <div className="flex items-end gap-1 rounded-[24px] bg-white p-1.5 shadow-rz-soft ring-1 ring-rz-line focus-within:ring-rz-primary/40">
            <textarea
              value={text}
              onChange={event => setText(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={Math.min(5, Math.max(1, text.split('\n').length))}
              placeholder="Escreva a sua resposta…"
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] outline-none placeholder:text-rz-muted"
              aria-label="Resposta"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || isSending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-primary text-white disabled:opacity-40"
              aria-label="Enviar resposta"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
