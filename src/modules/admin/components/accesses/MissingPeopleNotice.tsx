import React, { useState } from 'react';
import { ChevronDown, Link2, Plus, UserRoundX } from 'lucide-react';
import type { Credential, CredentialEmployee } from '../../lib/credentials';

interface MissingPeopleNoticeProps {
  people: CredentialEmployee[];
  /** "sem email pessoal", "sem acesso principal"… */
  what: string;
  canManage: boolean;
  onCreate: (employee: CredentialEmployee) => void;
  /** Acessos que já existem e parecem ser desta pessoa (sem dono): associar em vez de criar. */
  suggest?: (employee: CredentialEmployee) => Credential[];
  onLink?: (employee: CredentialEmployee, credential: Credential) => void;
}

const CHIP =
  'inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12.5px] ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-60';

/**
 * Aviso dobrável com quem ainda não tem um acesso: associar o que já existe (quando há
 * sugestão) ou criar um novo.
 */
export const MissingPeopleNotice: React.FC<MissingPeopleNoticeProps> = ({
  people,
  what,
  canManage,
  onCreate,
  suggest,
  onLink,
}) => {
  const [open, setOpen] = useState(false);
  if (people.length === 0) return null;
  const withSuggestion = suggest ? people.filter(p => suggest(p).length > 0) : [];
  const withoutSuggestion = people.filter(p => !withSuggestion.includes(p));

  return (
    <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-semibold text-amber-900"
      >
        <UserRoundX className="h-4 w-4" />
        {people.length} {people.length === 1 ? 'colaborador' : 'colaboradores'} {what}
        {withSuggestion.length > 0 && (
          <span className="rounded-full bg-white px-2 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {withSuggestion.length} com email já nos Acessos
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-3">
          {withSuggestion.length > 0 && (
            <ul className="space-y-1.5">
              {withSuggestion.map(person => (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center gap-1.5 text-[13px] text-amber-950"
                >
                  <span className="mr-1 font-semibold">{person.name}</span>
                  {suggest!(person).map(credential => (
                    <button
                      key={credential.id}
                      type="button"
                      onClick={() => onLink?.(person, credential)}
                      disabled={!canManage}
                      className={CHIP}
                      title="Fica o dono deste email (e a caixa liga ao Webmail dele)"
                    >
                      <Link2 className="h-3 w-3" /> Associar {credential.username}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onCreate(person)}
                    disabled={!canManage}
                    className={CHIP}
                  >
                    <Plus className="h-3 w-3" /> Outro
                  </button>
                </li>
              ))}
            </ul>
          )}
          {withoutSuggestion.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {withoutSuggestion.map(person => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onCreate(person)}
                    disabled={!canManage}
                    className={CHIP}
                  >
                    {canManage && <Plus className="h-3 w-3" />}
                    {person.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
