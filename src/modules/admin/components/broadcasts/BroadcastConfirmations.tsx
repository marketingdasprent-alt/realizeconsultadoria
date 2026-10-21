import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BellRing, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useEmployeeAvatars } from '../../hooks/useEmployeeAvatars';
import type { BroadcastEmployee } from '../../lib/broadcast';
import type { Confirmations } from '../../lib/broadcastReads';
import { PersonAvatar } from '../requests/requestStyles';

interface BroadcastConfirmationsProps {
  confirmations: Confirmations;
  reach: number;
  isLoading: boolean;
  reminding: boolean;
  canRemind: boolean;
  onRemind: () => void;
}

const Person: React.FC<{ person: BroadcastEmployee; detail: string }> = ({ person, detail }) => {
  const avatarOf = useEmployeeAvatars();
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <PersonAvatar name={person.name} url={avatarOf(person.user_id)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">{person.name}</span>
        <span className="block truncate text-[12px] text-rz-muted">{detail}</span>
      </span>
    </li>
  );
};

/** Quem confirmou a leitura na app (com a hora) e quem falta, com "Lembrar quem falta". */
export const BroadcastConfirmations: React.FC<BroadcastConfirmationsProps> = ({
  confirmations,
  reach,
  isLoading,
  reminding,
  canRemind,
  onRemind,
}) => {
  if (isLoading) return <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-rz-primary" />;
  const done = confirmations.confirmed.length;
  const percent = reach ? Math.round((done / reach) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[15px] font-bold">
            {done} de {reach} confirmaram
          </p>
          <span className="text-[13px] font-semibold text-rz-muted">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-rz-canvas">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {canRemind && confirmations.pending.length > 0 && (
        <button
          type="button"
          onClick={onRemind}
          disabled={reminding}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-4 text-[13.5px] font-bold text-white disabled:opacity-60"
        >
          {reminding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BellRing className="h-4 w-4" />
          )}
          Lembrar quem falta ({confirmations.pending.length})
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="overflow-hidden rounded-2xl ring-1 ring-rz-line">
          <h3 className="flex items-center gap-1.5 border-b border-rz-line bg-rz-canvas px-3 py-2 text-[12.5px] font-bold text-amber-700">
            <Clock className="h-4 w-4" /> Por confirmar ({confirmations.pending.length})
          </h3>
          <ul className="max-h-80 divide-y divide-rz-line overflow-y-auto">
            {confirmations.pending.map(person => (
              <Person
                key={person.id}
                person={person}
                detail={person.user_id ? (person.companyName ?? '') : 'Ainda sem conta na app'}
              />
            ))}
          </ul>
        </section>
        <section className="overflow-hidden rounded-2xl ring-1 ring-rz-line">
          <h3 className="flex items-center gap-1.5 border-b border-rz-line bg-rz-canvas px-3 py-2 text-[12.5px] font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Confirmaram ({done})
          </h3>
          <ul className="max-h-80 divide-y divide-rz-line overflow-y-auto">
            {confirmations.confirmed.map(({ employee, readAt }) => (
              <Person
                key={employee.id}
                person={employee}
                detail={format(parseISO(readAt), "d MMM 'às' HH:mm", { locale: pt })}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
