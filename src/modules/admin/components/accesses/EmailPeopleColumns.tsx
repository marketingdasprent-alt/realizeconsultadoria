import React from 'react';
import { Crown, Plus, Search, X } from 'lucide-react';
import type { CredentialEmployee } from '../../lib/credentials';
import { PersonRow } from './PersonRow';

const ICON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-white';

interface ColumnBase {
  title: string;
  avatarFor: (userId: string | null) => string | null;
  companyName: (companyId: string) => string;
}

interface SelectedColumnProps extends ColumnBase {
  people: CredentialEmployee[];
  /** null no departamental (não há dono). */
  owner: string | null;
  canHaveOwner: boolean;
  onMakeOwner: (id: string) => void;
  onRemove: (id: string) => void;
}

/** Coluna da esquerda: quem tem acesso (no email pessoal, com o dono marcado). */
export const SelectedColumn: React.FC<SelectedColumnProps> = ({
  title,
  people,
  owner,
  canHaveOwner,
  onMakeOwner,
  onRemove,
  avatarFor,
  companyName,
}) => (
  <section className="flex min-h-0 flex-col border-b border-rz-line sm:border-b-0 sm:border-r">
    <h3 className="shrink-0 px-5 pb-2 pt-4 text-[13px] font-bold text-rz-ink">
      {title} · {people.length}
    </h3>
    <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
      {people.length === 0 && (
        <li className="px-2 py-6 text-center text-[13px] text-rz-muted">
          Ninguém ainda. Junte pessoas à direita.
        </li>
      )}
      {people.map(person => {
        const isOwner = owner === person.id;
        return (
          <li key={person.id} className="rounded-2xl bg-rz-canvas px-3 py-2">
            <PersonRow
              person={person}
              avatarUrl={avatarFor(person.user_id)}
              companyName={companyName(person.company_id)}
              badge={
                isOwner && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 text-[11px] font-bold text-amber-800">
                    Dono
                  </span>
                )
              }
            >
              {canHaveOwner && !isOwner && (
                <button
                  type="button"
                  onClick={() => onMakeOwner(person.id)}
                  className={`${ICON} hover:text-amber-600`}
                  aria-label={`Tornar ${person.name} dono`}
                  title="Tornar dono"
                >
                  <Crown className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(person.id)}
                className={`${ICON} hover:text-rose-600`}
                aria-label={`Tirar ${person.name}`}
                title="Tirar"
              >
                <X className="h-4 w-4" />
              </button>
            </PersonRow>
          </li>
        );
      })}
    </ul>
  </section>
);

interface CandidateColumnProps extends ColumnBase {
  candidates: CredentialEmployee[];
  search: string;
  onSearch: (value: string) => void;
  onAdd: (id: string) => void;
  actionLabel: string;
}

/** Coluna da direita: pesquisa e toda a gente que ainda não tem acesso. */
export const CandidateColumn: React.FC<CandidateColumnProps> = ({
  title,
  actionLabel,
  candidates,
  search,
  onSearch,
  onAdd,
  avatarFor,
  companyName,
}) => (
  <section className="flex min-h-0 flex-col">
    <div className="shrink-0 space-y-2 px-5 pb-2 pt-4">
      <h3 className="text-[13px] font-bold text-rz-ink">{title}</h3>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
        <input
          value={search}
          onChange={event => onSearch(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (candidates[0]) onAdd(candidates[0].id);
          }}
          placeholder="Procurar pelo nome"
          autoFocus
          className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[13.5px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary"
        />
      </div>
    </div>
    <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      {candidates.length === 0 && (
        <li className="px-2 py-6 text-center text-[13px] text-rz-muted">Ninguém com esse nome.</li>
      )}
      {candidates.map(person => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onAdd(person.id)}
            className="w-full rounded-2xl px-3 py-2 text-left hover:bg-rz-primary-soft"
          >
            <PersonRow
              person={person}
              avatarUrl={avatarFor(person.user_id)}
              companyName={companyName(person.company_id)}
            >
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rz-primary-soft px-2.5 py-1 text-[12px] font-semibold text-rz-primary">
                <Plus className="h-3.5 w-3.5" /> {actionLabel}
              </span>
            </PersonRow>
          </button>
        </li>
      ))}
    </ul>
  </section>
);
