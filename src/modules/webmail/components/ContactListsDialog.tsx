import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { recipientEmails, type ContactEntry, type ContactList } from '../lib/recipients';
import { RecipientField } from './RecipientField';

interface ContactListsDialogProps {
  open: boolean;
  onClose: () => void;
  lists: ContactList[];
  team: ContactEntry[];
  contacts: ContactEntry[];
  /** Devolve o id da lista gravada (null se falhou). */
  onSave: (list: { id?: string; name: string; members: ContactEntry[] }) => Promise<string | null>;
  onDelete: (id: string) => Promise<boolean>;
}

const NEW = 'new';

/** Listas de contactos: um nome e as pessoas; ao escrever o nome da lista vão todas. */
export const ContactListsDialog: React.FC<ContactListsDialogProps> = ({
  open,
  onClose,
  lists,
  team,
  contacts,
  onSave,
  onDelete,
}) => {
  const [selected, setSelected] = useState<string>(NEW);
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [busy, setBusy] = useState(false);
  const current = lists.find(list => list.id === selected) ?? null;

  useEffect(() => {
    if (!open) return;
    setSelected(lists[0]?.id ?? NEW);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [open]);

  useEffect(() => {
    setName(current?.name ?? '');
    setMembers(current ? current.members.map(member => member.email).join(', ') : '');
    // Também ao voltar a "Nova lista": o formulário fica limpo.
  }, [current, selected]);

  const known = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const entry of [...contacts, ...team]) {
      const email = entry.email.toLowerCase();
      if (!map.get(email)) map.set(email, entry.name);
    }
    for (const member of lists.flatMap(list => list.members))
      if (member.name) map.set(member.email.toLowerCase(), member.name);
    return map;
  }, [contacts, team, lists]);

  const emails = recipientEmails(members);
  const canSave = name.trim().length > 0 && emails.length > 0 && !busy;

  const save = async () => {
    setBusy(true);
    const savedId = await onSave({
      id: current?.id,
      name,
      members: emails.map(email => ({ email, name: known.get(email) ?? null })),
    });
    setBusy(false);
    // A lista nova fica escolhida à esquerda (vê-se que foi criada).
    if (savedId) setSelected(savedId);
  };

  const remove = async () => {
    if (!current) return;
    setBusy(true);
    const ok = await onDelete(current.id);
    setBusy(false);
    if (ok) setSelected(NEW);
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent
        onInteractOutside={event => event.preventDefault()}
        className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-2xl sm:rounded-[28px]"
      >
        <DialogTitle className="text-xl font-extrabold">Listas de contactos</DialogTitle>
        <DialogDescription>
          Crie listas (ex.: Equipa Marketing) e, ao escrever um email, escolha a lista para juntar
          todas as pessoas de uma vez. São só suas.
        </DialogDescription>

        <div className="grid gap-4 sm:grid-cols-[13rem_1fr]">
          <ul className="space-y-1">
            {lists.map(list => (
              <li key={list.id}>
                <button
                  type="button"
                  onClick={() => setSelected(list.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[13.5px] font-semibold',
                    selected === list.id
                      ? 'bg-rz-primary-soft text-rz-primary'
                      : 'hover:bg-rz-canvas'
                  )}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                  <span className="text-[12px] font-normal text-rz-muted">
                    {list.members.length}
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setSelected(NEW)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[13.5px] font-semibold text-rz-primary',
                  selected === NEW ? 'bg-rz-primary-soft' : 'hover:bg-rz-canvas'
                )}
              >
                <Plus className="h-4 w-4" /> Nova lista
              </button>
            </li>
          </ul>

          <div className="space-y-3">
            <input
              value={name}
              onChange={event => setName(event.target.value.slice(0, 60))}
              placeholder="Nome da lista"
              aria-label="Nome da lista"
              className="h-11 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
            />
            <div className="min-h-[7rem] rounded-2xl bg-rz-canvas px-3 py-1 ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
              <RecipientField
                value={members}
                onChange={setMembers}
                team={team}
                contacts={contacts}
                lists={lists}
                allowLists={false}
                label="Pessoas da lista"
                placeholder="Escreva um nome ou email e escolha"
              />
            </div>
            <p className="text-[12.5px] text-rz-muted">
              {emails.length} {emails.length === 1 ? 'pessoa' : 'pessoas'} na lista. Pode colar
              vários emails de uma vez, separados por vírgula.
            </p>
            <div className="flex items-center gap-2">
              {current && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar lista
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="ml-auto inline-flex h-10 items-center rounded-full bg-rz-primary px-6 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {current ? 'Guardar' : 'Criar lista'}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
