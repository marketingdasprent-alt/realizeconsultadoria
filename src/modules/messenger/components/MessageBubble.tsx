import React from 'react';
import { format } from 'date-fns';
import { Ban, CheckCheck, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../types';
import { AudioAttachment } from './attachments/AudioAttachment';
import { FileAttachment } from './attachments/FileAttachment';
import { ImageAttachment } from './attachments/ImageAttachment';
import { MessageActions, type MessageActionHandlers } from './MessageActions';

interface MessageBubbleProps extends MessageActionHandlers {
  message: ChatMessage;
  /** Mostrar o autor (grupos e canais, primeira mensagem de uma sequência). */
  showAuthor: boolean;
  /** No telemóvel as ações aparecem só na mensagem tocada. */
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  /** Destaque da pesquisa na conversa. */
  isMatch?: boolean;
}

const Body: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.deleted) {
    return (
      <span className="flex items-center gap-1.5 italic opacity-70">
        <Ban className="h-3.5 w-3.5" /> Mensagem eliminada
      </span>
    );
  }
  return (
    <>
      {message.kind === 'image' && <ImageAttachment message={message} />}
      {message.kind === 'file' && <FileAttachment message={message} />}
      {message.kind === 'audio' && <AudioAttachment message={message} />}
      {message.text && (
        <span
          className={cn('block whitespace-pre-wrap break-words', message.kind !== 'text' && 'mt-2')}
        >
          {message.text}
        </span>
      )}
    </>
  );
};

/** Mensagem: texto ou anexo, resposta citada, hora, leitura, reações e ações. */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showAuthor,
  isSelected,
  onSelect,
  isMatch,
  ...handlers
}) => {
  const mine = message.isMine;
  const canAct = !message.deleted && !message.pending;
  return (
    <div className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
      {showAuthor && !mine && (
        <span className="mb-1 ml-3 text-xs font-semibold text-rz-primary">
          {message.authorName}
        </span>
      )}
      <div className={cn('flex max-w-full items-center gap-2', mine && 'flex-row-reverse')}>
        <div
          onClick={() => onSelect(isSelected ? null : message.id)}
          className={cn(
            'min-w-0 max-w-[min(34rem,78vw)] rounded-[22px] px-4 py-2.5 text-[14.5px] leading-relaxed shadow-sm transition-shadow',
            mine
              ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
              : 'rounded-bl-md bg-white text-rz-ink ring-1 ring-rz-line',
            message.pending && 'opacity-70',
            isMatch && 'ring-2 ring-amber-400'
          )}
        >
          {message.replyTo && !message.deleted && (
            <span
              className={cn(
                'mb-2 block rounded-xl border-l-[3px] px-3 py-1.5 text-[13px]',
                mine ? 'border-white/60 bg-white/15' : 'border-rz-primary bg-rz-primary-soft'
              )}
            >
              <span className="block font-semibold">{message.replyTo.authorName}</span>
              <span className="line-clamp-1 opacity-80">{message.replyTo.text}</span>
            </span>
          )}
          <Body message={message} />
          <span
            className={cn(
              'mt-1 flex items-center justify-end gap-1 text-[11px]',
              mine ? 'text-white/70' : 'text-rz-muted'
            )}
          >
            {message.editedAt && !message.deleted && <span>editada ·</span>}
            {format(new Date(message.createdAt), 'HH:mm')}
            {message.pending && <Clock3 className="h-3 w-3" aria-label="A enviar" />}
            {mine && message.read && <CheckCheck className="h-3.5 w-3.5" aria-label="Lida" />}
          </span>
        </div>
        {canAct && (
          <div className={cn(!isSelected && 'hidden md:block')}>
            <MessageActions message={message} {...handlers} />
          </div>
        )}
      </div>
      {!message.deleted && message.reactions && message.reactions.length > 0 && (
        <div className={cn('-mt-1.5 flex flex-wrap gap-1', mine ? 'mr-3' : 'ml-3')}>
          {message.reactions.map(reaction => (
            <button
              key={reaction.emoji}
              type="button"
              onClick={() => handlers.onReact(message, reaction.emoji)}
              className={cn(
                'rounded-full bg-white px-2 py-0.5 text-xs shadow-sm ring-1 transition-colors hover:bg-rz-canvas',
                reaction.mine ? 'ring-rz-primary/50' : 'ring-rz-line'
              )}
            >
              {reaction.emoji} {reaction.count > 1 && reaction.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
