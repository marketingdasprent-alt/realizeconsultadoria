import React, { useState } from 'react';
import { Crown, Loader2, LogOut, UserPlus, X } from 'lucide-react';
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

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    await task();
    setBusy(null);
  };

  return (
    <section className="space-y-3 border-t border-rz-line pt-4">
      <p className="text-[13px] font-bold">Pessoas no grupo ({members.length})</p>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {sorted.map(member => (
          <li key={member.userId} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
            <UserAvatar name={nameOf(member.userId)} userId={member.userId} size="xs" />
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
