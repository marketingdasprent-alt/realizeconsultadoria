import React, { useMemo, useState } from 'react';
import { matchesText } from '@/lib/text';
import { Check, Loader2, Search, Users, X } from 'lucide-react';
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
import { groupTitle } from '../lib/groupTitle';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (conversationId: string) => void;
}

/**
 * Nova conversa (briefing §5): colegas da mesma empresa, com pesquisa por nome, cargo ou
 * departamento. Um colega → conversa privada; vários → grupo (o nome é opcional).
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
    const term = query;
    return api.directory.filter(p => matchesText(term, p.name, p.position, p.department));
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
  const canCreate = selected.length > 0 && !isBusy;
  // Sem nome escrito, o grupo fica com os primeiros nomes de quem lá está.
  const defaultTitle = groupTitle(
    selected.map(id => api.directory.find(p => p.userId === id)?.name.split(' ')[0] ?? '')
  );

  const create = async () => {
    if (!canCreate) return;
    setIsBusy(true);
    const id = isGroup
      ? await api.createGroup(title.trim() || defaultTitle, selected)
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
        <div className="space-y-3 px-6 pb-3">
          {isGroup && (
            <div className="rounded-2xl bg-rz-primary-soft p-3 ring-1 ring-rz-primary/20">
              <label className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-rz-primary">
                <Users className="h-4 w-4" /> Novo grupo · {selected.length} colegas
              </label>
              <input
                value={title}
                onChange={event => setTitle(event.target.value.slice(0, 80))}
                placeholder="Dê um nome ao grupo"
                aria-label="Nome do grupo"
                className="h-12 w-full rounded-xl bg-white px-4 text-[15px] font-semibold text-rz-ink outline-none ring-2 ring-rz-primary/30 placeholder:font-normal placeholder:text-rz-muted focus:ring-rz-primary"
              />
              <p className="mt-1.5 text-[12px] text-rz-muted">
                Opcional. Se não escrever, fica <b className="text-rz-ink">{defaultTitle}</b>.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.map(id => {
                  const person = api.directory.find(p => p.userId === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-1 pr-2 text-[12px] font-semibold ring-1 ring-rz-line hover:ring-rose-300"
                      aria-label={`Tirar ${person?.name ?? ''} do grupo`}
                    >
                      <UserAvatar name={person?.name ?? '?'} userId={id} size="xs" />
                      {person?.name.split(' ')[0]}
                      <X className="h-3 w-3 text-rz-muted" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
