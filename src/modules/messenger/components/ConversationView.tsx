import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useMessengerApi } from '../context/useMessengerApi';
import type { ChatMessage, ConversationSummary } from '../types';
import { ConversationHeader } from './ConversationHeader';
import { TaskFormDialog } from '@/modules/tasks/components/TaskFormDialog';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { DeleteMessageDialog } from './DeleteMessageDialog';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';
import { DropOverlay } from '@/modules/workspace/components/DropOverlay';
import { useFileDrop } from '@/modules/workspace/hooks/useFileDrop';

interface ConversationViewProps {
  conversation: ConversationSummary;
  onBack: () => void;
}

/** Conversa aberta: cabeçalho, histórico (com pesquisa) e caixa de escrita. */
export const ConversationView: React.FC<ConversationViewProps> = ({ conversation, onBack }) => {
  const api = useMessengerApi();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  // Mensagem a transformar em tarefa (briefing §28: Chat → Tarefas).
  const [taskFrom, setTaskFrom] = useState<ChatMessage | null>(null);
  const tasks = useTasks();
  const searchRef = useRef<HTMLInputElement>(null);

  // Trocar de conversa limpa a resposta, a edição e a pesquisa.
  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
    setSearch(null);
  }, [conversation.id]);

  useEffect(() => {
    if (search !== null) searchRef.current?.focus();
  }, [search]);

  // Ficheiros largados na conversa: uma mensagem por ficheiro (a resposta vai no primeiro).
  const sendFiles = (files: File[]) => {
    files.forEach((file, index) =>
      api.send({ file, replyToId: index === 0 ? replyTo?.id : undefined })
    );
    setReplyTo(null);
  };
  const { isDragging, dropProps } = useFileDrop(sendFiles, conversation.canPost && !editing);

  const copy = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.text ?? '');
      toast({ title: 'Texto copiado' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col"
      aria-label={conversation.title}
      {...dropProps}
    >
      <DropOverlay visible={isDragging} label={`Largue para enviar a ${conversation.title}`} />
      <ConversationHeader
        conversation={conversation}
        typing={api.typing}
        isSearching={search !== null}
        onBack={onBack}
        onToggleSearch={() => setSearch(current => (current === null ? '' : null))}
        onFlag={(flag, value) => api.setFlag(conversation.id, flag, value)}
      />
      {search !== null && (
        <div className="border-b border-rz-line bg-white/80 px-4 py-2 md:px-6">
          <input
            ref={searchRef}
            value={search}
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => event.key === 'Escape' && setSearch(null)}
            placeholder="Procurar nas mensagens carregadas…"
            className="h-10 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
          />
        </div>
      )}

      {api.messagesLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-rz-primary" />
        </div>
      ) : (
        <MessageList
          key={conversation.id}
          messages={api.messages}
          showAuthors={conversation.kind !== 'direct' && conversation.kind !== 'ai'}
          search={search ?? ''}
          hasOlder={api.hasOlder}
          onLoadOlder={api.loadOlder}
          handlers={{
            onReply: message => {
              setEditing(null);
              setReplyTo(message);
            },
            onReact: (message, emoji) => api.toggleReaction(message.id, emoji),
            onEdit: message => {
              setReplyTo(null);
              setEditing(message);
            },
            onDelete: setToDelete,
            onCopy: copy,
            onCreateTask: setTaskFrom,
          }}
        />
      )}

      <div className="pb-24 md:pb-0">
        <MessageComposer
          onSend={input => {
            api.send(input);
            setReplyTo(null);
          }}
          onEdit={(message, text) => {
            api.editMessage(message.id, text);
            setEditing(null);
          }}
          onTyping={api.notifyTyping}
          replyTo={replyTo}
          editing={editing}
          onCancel={() => {
            setReplyTo(null);
            setEditing(null);
          }}
          disabled={!conversation.canPost}
          disabledHint="Só quem gere este canal pode publicar"
        />
      </div>

      <TaskFormDialog
        open={!!taskFrom}
        onOpenChange={value => !value && setTaskFrom(null)}
        title="Criar tarefa a partir da mensagem"
        initial={
          taskFrom
            ? {
                title: (taskFrom.text ?? taskFrom.attachment?.name ?? 'Mensagem').slice(0, 120),
                description: `${taskFrom.text ?? ''}

— ${taskFrom.authorName}, em ${conversation.title}`.trim(),
                sourceType: 'message',
                sourceRef: `${conversation.id}:${taskFrom.id}`,
              }
            : undefined
        }
        onSave={tasks.create}
      />
      <DeleteMessageDialog
        message={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={message => api.deleteMessage(message.id)}
      />
    </section>
  );
};
