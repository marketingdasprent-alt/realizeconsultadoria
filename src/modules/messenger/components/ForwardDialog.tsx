import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { matchesText } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useMessengerApi } from '../context/useMessengerApi';
import type { ChatMessage } from '../types';
import { ConversationAvatar } from './ConversationAvatar';

interface ForwardDialogProps {
  /** Uma ou várias mensagens (selecionadas na conversa). */
  messages: ChatMessage[] | null;
  onClose: () => void;
}

const preview = (message: ChatMessage) =>
  message.kind === 'image'
    ? '🖼️ Imagem'
    : message.kind === 'audio'
      ? '🎤 Mensagem de voz'
      : message.kind === 'file'
        ? `📎 ${message.attachment?.name ?? 'Ficheiro'}`
        : (message.text ?? '');

/** Escolher as conversas para onde encaminhar uma mensagem (texto, imagem, ficheiro ou voz). */
export const ForwardDialog: React.FC<ForwardDialogProps> = ({ messages, onClose }) => {
  const message = messages?.[0] ?? null;
  const api = useMessengerApi();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!messages?.length) return;
    setQuery('');
    setSelected([]);
    setBusy(false);
  }, [messages]);

  const options = useMemo(
    () => api.conversations.filter(c => c.canPost && matchesText(query, c.title)),
    [api.conversations, query]
  );

  const toggle = (id: string) =>
    setSelected(list => (list.includes(id) ? list.filter(v => v !== id) : [...list, id]));

  const submit = async () => {
    if (!messages?.length || !selected.length) return;
    setBusy(true);
    await api.forwardMessage(messages, selected);
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open={!!messages?.length} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[94vw] max-w-md flex-col gap-0 overflow-hidden rounded-[28px] p-0">
        <div className="px-6 pb-3 pt-6">
          <DialogTitle className="text-xl font-extrabold">Encaminhar</DialogTitle>
          {message && (
            <p className="mt-2 line-clamp-2 rounded-2xl bg-rz-canvas px-3 py-2 text-[13px] text-rz-muted">
              {messages && messages.length > 1
                ? `${messages.length} mensagens: ${messages
                    .slice(0, 3)
                    .map(preview)
                    .join(' · ')}${messages.length > 3 ? '…' : ''}`
                : preview(message)}
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 rounded-2xl bg-rz-canvas px-3 ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
            <Search className="h-4 w-4 text-rz-muted" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Procurar conversa"
              className="h-10 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <ul className="rz-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
          {options.map(conversation => {
            const on = selected.includes(conversation.id);
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => toggle(conversation.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-rz-canvas',
                    on && 'bg-rz-primary-soft'
                  )}
                >
                  <ConversationAvatar conversation={conversation} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {conversation.title}
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full ring-1',
                      on ? 'bg-rz-primary text-white ring-rz-primary' : 'ring-rz-line'
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
          {options.length === 0 && (
            <li className="py-6 text-center text-sm text-rz-muted">Nenhuma conversa encontrada.</li>
          )}
        </ul>
        <div className="flex justify-end gap-2 border-t border-rz-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full px-5 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!selected.length || busy}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-6 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {selected.length > 1 ? `Encaminhar para ${selected.length}` : 'Encaminhar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
