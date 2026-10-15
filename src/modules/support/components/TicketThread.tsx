import React, { useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ArrowLeft, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropOverlay } from '@/modules/workspace/components/DropOverlay';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useFileDrop } from '@/modules/workspace/hooks/useFileDrop';
import { useTicketThread } from '../hooks/useMyTickets';
import { useTicketFiles } from '../hooks/useTicketFiles';
import { buildTimeline } from '../lib/ticketFiles';
import { isTicketClosed, type SupportTicket, type TicketAttachment } from '../lib/ticketRules';
import { TicketAttachmentChip } from './TicketAttachmentChip';
import { TicketBadges } from './TicketBadges';
import { TicketReplyBox } from './TicketReplyBox';

interface TicketThreadProps {
  ticket: SupportTicket;
  attachments: TicketAttachment[];
  onBack: () => void;
}

const When: React.FC<{ at: string; mine: boolean }> = ({ at, mine }) => (
  <span
    className={cn('mt-1 block text-right text-[11px]', mine ? 'text-white/70' : 'text-rz-muted')}
  >
    {format(new Date(at), "d MMM 'às' HH:mm", { locale: pt })}
  </span>
);

const Side: React.FC<{ mine: boolean; children: React.ReactNode }> = ({ mine, children }) => (
  <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
    {!mine && (
      <span className="mb-1 ml-3 inline-flex items-center gap-1 text-xs font-bold text-rz-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> Recursos Humanos
      </span>
    )}
    {children}
  </div>
);

/** Conversa de um ticket: pedido, respostas e anexos por ordem, e a caixa de resposta. */
export const TicketThread: React.FC<TicketThreadProps> = ({ ticket, attachments, onBack }) => {
  const { user } = useWorkspace();
  const { replies, isLoading, isSending, reply } = useTicketThread(ticket);
  const files = useTicketFiles();
  const endRef = useRef<HTMLDivElement>(null);
  const closed = isTicketClosed(ticket);
  const { isDragging, dropProps } = useFileDrop(files.add, !closed);
  const timeline = useMemo(
    () => buildTimeline(ticket, attachments, replies, user.userId),
    [ticket, attachments, replies, user.userId]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [timeline.length, ticket.id]);

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col"
      aria-label={ticket.subject}
      {...dropProps}
    >
      <DropOverlay visible={isDragging} label="Largue para anexar à resposta" />
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
        {timeline.map(item => (
          <Side key={item.key} mine={item.mine}>
            {item.kind === 'message' ? (
              <div
                className={cn(
                  'max-w-[min(34rem,85%)] rounded-[22px] px-4 py-2.5 text-[14.5px] leading-relaxed shadow-sm',
                  item.mine
                    ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                    : 'rounded-bl-md bg-white ring-1 ring-rz-line'
                )}
              >
                <span className="whitespace-pre-wrap">{item.text}</span>
                <When at={item.at} mine={item.mine} />
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-1.5">
                {item.files.map(file => (
                  <TicketAttachmentChip key={file.id} attachment={file} />
                ))}
              </div>
            )}
          </Side>
        ))}
        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />}
        <div ref={endRef} />
      </div>

      <div className="px-3 pb-24 pt-2 md:px-5 md:pb-5">
        {closed ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-rz-canvas px-4 py-3 text-[13.5px] text-rz-muted">
            <Lock className="h-4 w-4" /> Este ticket está encerrado. Para outro assunto, abra um
            novo pedido.
          </p>
        ) : (
          <TicketReplyBox
            files={files.files}
            onAddFiles={files.add}
            onRemoveFile={files.remove}
            isSending={isSending}
            onSend={async text => {
              const ok = await reply(text, files.files);
              if (ok) files.clear();
              return ok;
            }}
          />
        )}
      </div>
    </section>
  );
};
