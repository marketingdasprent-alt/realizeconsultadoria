import React, { useState } from 'react';
import { Crown, Loader2, LogOut, Search, UserPlus, X } from 'lucide-react';
import { matchesText } from '@/lib/text';
import { PeoplePicker } from '@/modules/social/components/PeoplePicker';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { DirectoryPerson } from '../types';

interface GroupMembersSectionProps {
  conversationId: string;
  members: { userId: string; role: string }[];
  directory: DirectoryPerson[];
  me: { userId: string; name: string };
  onAdd: (userIds: string[]) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  /** Saiu do grupo: fecha a janela. */
  onLeft: () => void;
}

/**
 * Pessoas do grupo: qualquer membro adiciona colegas; só o dono (quem criou) tira pessoas;
 * cada um pode sair.
 */
export const GroupMembersSection: React.FC<GroupMembersSectionProps> = ({
  members,
  directory,
  me,
  onAdd,
  onRemove,
  onLeft,
}) => {
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const byId = new Map(directory.map(p => [p.userId, p]));
  const iAmOwner = members.some(m => m.userId === me.userId && m.role === 'owner');
  const nameOf = (id: string) =>
    id === me.userId ? `${me.name} (eu)` : (byId.get(id)?.name ?? 'Antigo colaborador');
  const sorted = [...members].sort(
    (a, b) =>
      Number(b.role === 'owner') - Number(a.role === 'owner') ||
      nameOf(a.userId).localeCompare(nameOf(b.userId), 'pt')
  );
  const inGroup = new Set(members.map(m => m.userId));
  const shown = sorted.filter(member => matchesText(search, nameOf(member.userId)));

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    await task();
    setBusy(null);
  };

  return (
    <section className="space-y-3">
      <p className="text-[15px] font-extrabold">Pessoas no grupo ({members.length})</p>
      {members.length > 6 && (
        <label className="flex h-10 items-center gap-2 rounded-full bg-rz-canvas px-3 text-rz-muted focus-within:ring-2 focus-within:ring-rz-primary/30">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar pessoas do grupo"
            aria-label="Pesquisar pessoas do grupo"
            className="w-full bg-transparent text-[13.5px] text-rz-ink outline-none placeholder:text-rz-muted"
          />
        </label>
      )}
      <ul className="rz-scroll max-h-[min(42vh,22rem)] min-h-[10rem] space-y-0.5 overflow-y-auto pr-1">
        {shown.length === 0 && search.trim() !== '' && (
          <li className="px-1 py-3 text-center text-[13px] text-rz-muted">
            Ninguém com esse nome.
          </li>
        )}
        {shown.map(member => (
          <li
            key={member.userId}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-rz-canvas"
          >
            <UserAvatar name={nameOf(member.userId)} userId={member.userId} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
              {nameOf(member.userId)}
            </span>
            {member.role === 'owner' && (
              <span
                className="flex items-center gap-1 text-[11.5px] font-semibold text-rz-gold"
                title="Criou o grupo: pode tirar pessoas"
              >
                <Crown className="h-3.5 w-3.5" /> Dono
              </span>
            )}
            {iAmOwner && member.userId !== me.userId && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run(member.userId, () => onRemove(member.userId))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Tirar ${nameOf(member.userId)} do grupo`}
                title="Tirar do grupo"
              >
                {busy === member.userId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <PeoplePicker
          value={toAdd.filter(id => !inGroup.has(id))}
          onChange={setToAdd}
          placeholder="Adicionar pessoas"
        />
        {toAdd.some(id => !inGroup.has(id)) && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void run('add', async () => {
                await onAdd(toAdd.filter(id => !inGroup.has(id)));
                setToAdd([]);
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy === 'add' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Adicionar ao grupo
          </button>
        )}
      </div>

      {confirmLeave ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 p-3 text-[13px]">
          <span className="flex-1 font-semibold text-rose-700">
            Sair do grupo? Deixa de ver as mensagens.
          </span>
          <button
            type="button"
            onClick={() => setConfirmLeave(false)}
            className="h-8 rounded-full px-3 font-semibold text-rz-muted hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void run('leave', async () => {
                await onRemove(me.userId);
                onLeft();
              })
            }
            className="h-8 rounded-full bg-rose-600 px-3 font-bold text-white disabled:opacity-50"
          >
            Sair
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-600 hover:underline"
        >
          <LogOut className="h-4 w-4" /> Sair do grupo
        </button>
      )}
    </section>
  );
};
