import React, { useState } from 'react';
import { ChevronDown, Plus, UserRoundX } from 'lucide-react';
import type { CredentialEmployee } from '../../lib/credentials';

interface MissingPeopleNoticeProps {
  people: CredentialEmployee[];
  /** "sem email pessoal", "sem acesso principal"… */
  what: string;
  canManage: boolean;
  onCreate: (employee: CredentialEmployee) => void;
}

/** Aviso dobrável com quem ainda não tem um acesso (e botão para o criar). */
export const MissingPeopleNotice: React.FC<MissingPeopleNoticeProps> = ({
  people,
  what,
  canManage,
  onCreate,
}) => {
  const [open, setOpen] = useState(false);
  if (people.length === 0) return null;
  return (
    <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-semibold text-amber-900"
      >
        <UserRoundX className="h-4 w-4" />
        {people.length} {people.length === 1 ? 'colaborador' : 'colaboradores'} {what}
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="flex flex-wrap gap-1.5 px-4 pb-3">
          {people.map(person => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onCreate(person)}
                disabled={!canManage}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12.5px] ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-60"
              >
                {canManage && <Plus className="h-3 w-3" />}
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
