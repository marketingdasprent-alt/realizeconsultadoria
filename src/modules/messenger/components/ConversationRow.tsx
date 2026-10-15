import React from 'react';
import { BellOff, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatListTime } from '../lib/format';
import type { ConversationSummary } from '../types';
import { ConversationAvatar } from './ConversationAvatar';

interface ConversationRowProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onSelect: (id: string) => void;
}

/** Linha da lista: avatar, nome, última mensagem, hora e não lidas. */
export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  isActive,
  onSelect,
}) => {
  const hasUnread = conversation.unread > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors',
        isActive ? 'bg-rz-primary-soft' : 'hover:bg-rz-canvas'
      )}
    >
      <ConversationAvatar conversation={conversation} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-[14.5px]',
              hasUnread ? 'font-bold' : 'font-semibold',
              isActive && 'text-rz-primary'
            )}
          >
            {conversation.title}
          </span>
          {conversation.pinned && <Pin className="h-3 w-3 shrink-0 text-rz-muted" />}
          {conversation.muted && <BellOff className="h-3 w-3 shrink-0 text-rz-muted" />}
          <span
            className={cn(
              'ml-auto shrink-0 text-[11.5px] tabular-nums',
              hasUnread ? 'font-semibold text-rz-primary' : 'text-rz-muted'
            )}
          >
            {formatListTime(conversation.lastAt)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              'line-clamp-1 flex-1 text-[13px]',
              hasUnread ? 'text-rz-ink' : 'text-rz-muted'
            )}
          >
            {conversation.lastAuthor && (
              <span className="font-semibold">{conversation.lastAuthor}: </span>
            )}
            {conversation.lastMessage}
          </span>
          {hasUnread && (
            <span
              className={cn(
                'min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5 text-white',
                conversation.muted ? 'bg-slate-400' : 'bg-rz-primary'
              )}
            >
              {conversation.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
};
