import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { matchesSearch } from '@/lib/utils';
import { useEmployeeAvatars } from '../../../hooks/useEmployeeAvatars';
import type { CredentialCompany, CredentialEmployee } from '../../../lib/credentials';
import { PersonAvatar } from '../../requests/requestStyles';

interface PeoplePickerProps {
  employees: CredentialEmployee[];
  companies: CredentialCompany[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Os desta empresa aparecem primeiro (a caixa pode ser partilhada com qualquer empresa). */
  preferCompanyId?: string;
  /** 1 = escolher só uma pessoa (o dono de um email pessoal). */
  max?: number;
  placeholder?: string;
}

/** Pessoas escolhidas (foto ou iniciais, empresa) e pesquisa para juntar mais. */
export const PeoplePicker: React.FC<PeoplePickerProps> = ({
  employees,
  companies,
  value,
  onChange,
  preferCompanyId,
  max,
  placeholder = 'Juntar pessoa — escreva o nome',
}) => {
  const [search, setSearch] = useState('');
  const avatarFor = useEmployeeAvatars();
  const byId = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? '';
  const options = useMemo(
    () =>
      search.trim()
        ? employees
            .filter(e => e.is_active && !value.includes(e.id) && matchesSearch(e.name, search))
            .sort(
              (a, b) =>
                Number(b.company_id === preferCompanyId) - Number(a.company_id === preferCompanyId)
            )
            .slice(0, 6)
        : [],
    [employees, search, value, preferCompanyId]
  );

  const add = (id: string) => {
    onChange(max === 1 ? [id] : [...value, id]);
    setSearch('');
  };

  const row = (person: CredentialEmployee, action: React.ReactNode) => (
    <span className="flex items-center gap-3">
      <PersonAvatar name={person.name} url={avatarFor(person.user_id)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-rz-ink">{person.name}</span>
        <span className="block truncate text-[12px] text-rz-muted">
          {companyName(person.company_id)}
          {!person.user_id && ' · sem conta na app (não vê a caixa)'}
        </span>
      </span>
      {action}
    </span>
  );

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map(id => {
            const person = byId.get(id);
            if (!person) return null;
            return (
              <li key={id} className="rounded-2xl bg-rz-canvas px-3 py-2">
                {row(
                  person,
                  <button
                    type="button"
                    onClick={() => onChange(value.filter(v => v !== id))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rose-600"
                    aria-label={`Tirar ${person.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          onKeyDown={event => {
            // Enter junta a primeira pessoa da lista (não guarda o formulário).
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (options[0]) add(options[0].id);
          }}
          placeholder={max === 1 && value.length > 0 ? 'Trocar — escreva outro nome' : placeholder}
          className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[13.5px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary"
        />
      </div>
      {options.length > 0 && (
        <ul className="overflow-hidden rounded-2xl bg-white shadow-rz-soft ring-1 ring-rz-line">
          {options.map(person => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => add(person.id)}
                className="w-full px-3 py-2 text-left hover:bg-rz-primary-soft"
              >
                {row(
                  person,
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rz-primary-soft px-2.5 py-1 text-[12px] font-semibold text-rz-primary">
                    <Plus className="h-3.5 w-3.5" /> {max === 1 ? 'Escolher' : 'Juntar'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
