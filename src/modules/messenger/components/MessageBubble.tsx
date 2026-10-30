import React from 'react';
import { format } from 'date-fns';
import { AlertCircle, Ban, CheckCheck, Clock3, RotateCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { richTextParts } from '@/modules/social/lib/richText';
import { mentionParts } from '../lib/mentions';
import { ReactionChips } from './ReactionChips';
import { useOptionalMessenger } from '../context/useMessengerApi';
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

/** Texto da mensagem: ligações clicáveis e os "@Nome" das pessoas marcadas em destaque. */
const MessageText: React.FC<{ text: string; mentions: string[] }> = ({ text, mentions }) => (
  <>
    {mentionParts(text, mentions).map((chunk, index) =>
      chunk.mention ? (
        <span key={index} className="rounded-md bg-black/10 px-0.5 font-bold">
          {chunk.text}
        </span>
      ) : (
        richTextParts(chunk.text).map((part, partIndex) =>
          part.kind === 'link' ? (
            <a
              key={`${index}-${partIndex}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={event => event.stopPropagation()}
              className="break-all font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {part.value}
            </a>
          ) : (
            <React.Fragment key={`${index}-${partIndex}`}>{part.value}</React.Fragment>
          )
        )
      )
    )}
  </>
);

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
          <MessageText text={message.text} mentions={message.mentionNames ?? []} />
        </span>
      )}
    </>
  );
};

/** Mensagem que não foi enviada: o texto fica e pode tentar-se outra vez ou descartar. */
const FailedNotice: React.FC<{ messageId: string }> = ({ messageId }) => {
  const api = useOptionalMessenger();
  return (
    <span className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-red-600">
      <AlertCircle className="h-3.5 w-3.5" /> Não enviada
      <button
        type="button"
        onClick={() => api?.retryMessage(messageId)}
        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 hover:bg-red-100"
      >
        <RotateCw className="h-3 w-3" /> Tentar outra vez
      </button>
      <button
        type="button"
        onClick={() => api?.discardMessage(messageId)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-rz-muted hover:bg-rz-canvas"
      >
        <X className="h-3 w-3" /> Descartar
      </button>
    </span>
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
  const canAct = !message.deleted && !message.pending && !message.failed;
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
            message.failed && 'opacity-80 ring-2 ring-red-300',
            isMatch && 'ring-2 ring-amber-400',
            // Fui marcado: a mensagem fica destacada.
            !isMatch && message.mentionsMe && !mine && 'ring-2 ring-rz-primary/50'
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
      {message.failed && <FailedNotice messageId={message.id} />}
      {!message.deleted && message.reactions && message.reactions.length > 0 && (
        <ReactionChips
          reactions={message.reactions}
          mine={mine}
          onReact={emoji => handlers.onReact(message, emoji)}
        />
      )}
    </div>
  );
};
