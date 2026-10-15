import React, { useMemo, useState } from 'react';
import { Check, Loader2, Search, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useMessengerApi } from '../context/useMessengerApi';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (conversationId: string) => void;
}

/**
 * Nova conversa (briefing §5): colegas da mesma empresa, com pesquisa por nome, cargo ou
 * departamento. Um colega → conversa privada; vários → grupo com nome.
 */
export const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  open,
  onOpenChange,
  onOpened,
}) => {
  const api = useMessengerApi();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const people = useMemo(() => {
    const term = query.trim().toLowerCase();
    return api.directory.filter(
      p => !term || [p.name, p.position, p.department].some(v => v?.toLowerCase().includes(term))
    );
  }, [api.directory, query]);

  const reset = () => {
    setQuery('');
    setSelected([]);
    setTitle('');
  };

  const toggle = (userId: string) =>
    setSelected(list =>
      list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId]
    );

  const isGroup = selected.length > 1;
  const canCreate = selected.length > 0 && (!isGroup || title.trim().length > 0) && !isBusy;

  const create = async () => {
    if (!canCreate) return;
    setIsBusy(true);
    const id = isGroup
      ? await api.createGroup(title.trim(), selected)
      : await api.startDirect(selected[0]);
    setIsBusy(false);
    if (!id) return;
    reset();
    onOpenChange(false);
    onOpened(id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={value => (value ? onOpenChange(true) : (reset(), onOpenChange(false)))}
    >
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-md sm:rounded-[28px]">
        <DialogHeader className="space-y-1 px-6 pb-3 pt-6 text-left">
          <DialogTitle className="text-xl font-extrabold">Nova conversa</DialogTitle>
          <DialogDescription>Escolha um colega, ou vários para criar um grupo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-6 pb-3">
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-rz-canvas px-3 text-rz-muted focus-within:bg-white focus-within:ring-1 focus-within:ring-rz-primary/40">
            <Search className="h-4 w-4" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Nome, cargo ou departamento"
              className="w-full bg-transparent text-sm text-rz-ink outline-none"
            />
          </label>
          {isGroup && (
            <label className="flex h-11 items-center gap-2 rounded-2xl bg-rz-primary-soft px-3 text-rz-primary">
              <Users className="h-4 w-4" />
              <input
                value={title}
                onChange={event => setTitle(event.target.value.slice(0, 80))}
                placeholder="Nome do grupo"
                className="w-full bg-transparent text-sm font-semibold text-rz-ink outline-none placeholder:font-normal"
              />
            </label>
          )}
        </div>
        <ul className="rz-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {people.map(person => {
            const isChecked = selected.includes(person.userId);
            return (
              <li key={person.userId}>
                <button
                  type="button"
                  onClick={() => toggle(person.userId)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors',
                    isChecked ? 'bg-rz-primary-soft' : 'hover:bg-rz-canvas'
                  )}
                  aria-pressed={isChecked}
                >
                  <UserAvatar name={person.name} userId={person.userId} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">
                      {person.name}
                    </span>
                    <span className="block truncate text-xs text-rz-muted">
                      {[person.position, person.department].filter(Boolean).join(' · ') ||
                        'Colaborador'}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full ring-2',
                      isChecked ? 'bg-rz-primary text-white ring-rz-primary' : 'ring-rz-line'
                    )}
                  >
                    {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </span>
                </button>
              </li>
            );
          })}
          {people.length === 0 && (
            <p className="py-8 text-center text-sm text-rz-muted">Nenhum colega encontrado.</p>
          )}
        </ul>
        <div className="border-t border-rz-line p-4">
          <button
            type="button"
            onClick={create}
            disabled={!canCreate}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isGroup ? `Criar grupo com ${selected.length} colegas` : 'Começar conversa'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
