import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TicketAttachments } from '@/modules/support/components/TicketAttachments';
import type { useTicketFiles } from '@/modules/support/hooks/useTicketFiles';
import { conversationBubbles } from '../../lib/supportTickets';
import type { TicketAttachmentRow, TicketReplyRow } from '../../services/supportAdminService';
import { TicketReplyComposer } from './TicketReplyComposer';

interface TicketConversationProps {
  employeeName: string;
  firstMessage: { text: string; at: string };
  /** Nota antiga ("Notas do Admin"), que o colaborador via como resposta. */
  legacyNote: string | null;
  replies: TicketReplyRow[];
  attachments: TicketAttachmentRow[];
  files: ReturnType<typeof useTicketFiles>;
  onReply: (message: string, files: File[]) => Promise<boolean>;
  disabled?: boolean;
}

/** Conversa com o colaborador: mensagens e anexos por ordem, e a caixa para responder. */
export const TicketConversation: React.FC<TicketConversationProps> = ({
  employeeName,
  firstMessage,
  legacyNote,
  replies,
  attachments,
  files,
  onReply,
  disabled,
}) => {
  const bubbles = conversationBubbles(firstMessage, legacyNote, replies, attachments);

  return (
    <div className="space-y-3">
      {bubbles.map(bubble => (
        <div
          key={bubble.key}
          className={cn('flex', bubble.fromEmployee ? 'justify-start' : 'justify-end')}
        >
          <div
            className={cn(
              'max-w-[85%] rounded-[20px] px-4 py-2.5',
              bubble.fromEmployee
                ? 'rounded-tl-md bg-rz-canvas'
                : 'rounded-tr-md bg-rz-primary text-white'
            )}
          >
            <p
              className={cn(
                'text-[11.5px] font-semibold',
                bubble.fromEmployee ? 'text-rz-muted' : 'text-white/80'
              )}
            >
              {bubble.fromEmployee ? employeeName : 'Suporte'}
              {bubble.at
                ? ` · ${format(new Date(bubble.at), "d MMM 'às' HH:mm", { locale: pt })}`
                : ''}
            </p>
            {bubble.text && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                {bubble.text}
              </p>
            )}
            {bubble.files.length > 0 && (
              <div className="mt-2 min-w-[220px] text-rz-ink">
                <TicketAttachments files={bubble.files} />
              </div>
            )}
          </div>
        </div>
      ))}

      <TicketReplyComposer
        employeeName={employeeName}
        files={files}
        onReply={onReply}
        disabled={disabled}
      />
    </div>
  );
};
