import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { matchesSearch } from '@/lib/utils';
import type { CredentialEmployee } from '../../../lib/credentials';

interface PeoplePickerProps {
  employees: CredentialEmployee[];
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Quem tem o email departamental: pessoas escolhidas (chips) e pesquisa para juntar. */
export const PeoplePicker: React.FC<PeoplePickerProps> = ({ employees, value, onChange }) => {
  const [search, setSearch] = useState('');
  const byId = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const options = useMemo(
    () =>
      search.trim()
        ? employees
            .filter(e => e.is_active && !value.includes(e.id) && matchesSearch(e.name, search))
            .slice(0, 6)
        : [],
    [employees, search, value]
  );

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map(id => {
            const person = byId.get(id);
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-rz-primary-soft py-1 pl-3 pr-1 text-[12.5px] font-medium text-rz-ink"
              >
                {person?.name ?? 'Colaborador'}
                {person && !person.user_id && (
                  <span className="text-rz-muted" title="Ainda não tem conta na app">
                    · sem conta
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter(v => v !== id))}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white"
                  aria-label={`Tirar ${person?.name ?? ''}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Input
        placeholder="Juntar pessoa (escreva o nome)…"
        value={search}
        onChange={event => setSearch(event.target.value)}
        onKeyDown={event => {
          // Enter junta a primeira pessoa da lista (não guarda o formulário).
          if (event.key !== 'Enter') return;
          event.preventDefault();
          if (options[0]) {
            onChange([...value, options[0].id]);
            setSearch('');
          }
        }}
        className="h-10"
      />
      {options.length > 0 && (
        <ul className="overflow-hidden rounded-xl ring-1 ring-rz-line">
          {options.map(person => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, person.id]);
                  setSearch('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-rz-canvas"
              >
                <Plus className="h-3.5 w-3.5 text-rz-primary" /> {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
