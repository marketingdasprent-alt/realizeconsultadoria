import React, { useEffect, useMemo, useRef, useState } from 'react';
import { matchesText } from '@/lib/text';
import { ChevronUp } from 'lucide-react';
import { formatDayDivider } from '../lib/format';
import type { ChatMessage } from '../types';
import { ImageLightbox } from './ImageLightbox';
import { ImageViewerContext } from './ImageViewerContext';
import { MessageBubble } from './MessageBubble';
import type { MessageActionHandlers } from './MessageActions';

interface MessageListProps {
  messages: ChatMessage[];
  showAuthors: boolean;
  search: string;
  hasOlder: boolean;
  onLoadOlder: () => void;
  handlers: MessageActionHandlers;
}

const dayKey = (iso: string) => new Date(iso).toDateString();

/** Histórico com separadores de dia; desce sozinho quando chega uma mensagem nova. */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  showAuthors,
  search,
  hasOlder,
  onLoadOlder,
  handlers,
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  // Imagens carregadas, da mais antiga à mais recente: a galeria passa de uma à outra.
  const images = useMemo(
    () =>
      messages.filter(m => m.kind === 'image' && !m.deleted && !m.pending && m.attachment?.path),
    [messages]
  );
  const viewerIndex = images.findIndex(m => m.id === viewerId);
  const term = search.trim();
  const lastId = messages[messages.length - 1]?.id ?? null;

  // Só desce quando a última mensagem muda (não ao carregar as anteriores).
  useEffect(() => {
    if (lastId === lastIdRef.current) return;
    const first = lastIdRef.current === null;
    lastIdRef.current = lastId;
    endRef.current?.scrollIntoView({ block: 'end', behavior: first ? 'auto' : 'smooth' });
  }, [lastId]);

  return (
    <ImageViewerContext.Provider value={setViewerId}>
      <div className="rz-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-6">
        {hasOlder && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onLoadOlder}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rz-primary shadow-sm ring-1 ring-rz-line"
            >
              <ChevronUp className="h-3.5 w-3.5" /> Mensagens anteriores
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-rz-muted">Diga olá 👋</p>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          const showAuthor =
            showAuthors && (newDay || !previous || previous.senderId !== message.senderId);
          return (
            <React.Fragment key={message.id}>
              {newDay && (
                <div className="flex justify-center py-2">
                  <span className="inline-block rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-rz-muted shadow-sm first-letter:uppercase ring-1 ring-rz-line">
                    {formatDayDivider(message.createdAt)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={message}
                showAuthor={showAuthor}
                isSelected={selectedId === message.id}
                onSelect={setSelectedId}
                isMatch={!!term && matchesText(term, message.text)}
                {...handlers}
              />
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
        {viewerIndex >= 0 && (
          <ImageLightbox
            images={images}
            index={viewerIndex}
            onIndexChange={index => setViewerId(images[index].id)}
            onClose={() => setViewerId(null)}
            onReply={handlers.onReply}
            onForward={handlers.onForward}
          />
        )}
      </div>
    </ImageViewerContext.Provider>
  );
};
