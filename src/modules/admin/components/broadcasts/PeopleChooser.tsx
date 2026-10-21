import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn, matchesSearch } from '@/lib/utils';
import { useEmployeeAvatars } from '../../hooks/useEmployeeAvatars';
import type { BroadcastEmployee } from '../../lib/broadcast';
import { PersonAvatar } from '../requests/requestStyles';

interface PeopleChooserProps {
  people: BroadcastEmployee[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Escolher pessoas uma a uma (pesquisa por nome, empresa ou departamento). */
export const PeopleChooser: React.FC<PeopleChooserProps> = ({ people, selected, onChange }) => {
  const avatarOf = useEmployeeAvatars();
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () =>
      people.filter(p =>
        matchesSearch([p.name, p.companyName, p.department].filter(Boolean).join(' '), search)
      ),
    [people, search]
  );
  const chosen = new Set(selected);
  const allVisible = visible.length > 0 && visible.every(p => chosen.has(p.id));

  const toggleAll = () => {
    const ids = new Set(selected);
    for (const p of visible) {
      if (allVisible) ids.delete(p.id);
      else ids.add(p.id);
    }
    onChange([...ids]);
  };

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-rz-line">
      <div className="flex items-center gap-2 border-b border-rz-line bg-white px-3">
        <Search className="h-4 w-4 text-rz-muted" />
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Procurar por nome, empresa ou departamento…"
          className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
        />
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 text-[12.5px] font-semibold text-rz-primary"
        >
          {allVisible ? 'Tirar estes' : 'Escolher estes'}
        </button>
      </div>
      <ul className="max-h-72 divide-y divide-rz-line overflow-y-auto bg-white">
        {visible.map(person => {
          const on = chosen.has(person.id);
          return (
            <li key={person.id}>
              <button
                type="button"
                onClick={() =>
                  onChange(on ? selected.filter(id => id !== person.id) : [...selected, person.id])
                }
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                  on ? 'bg-rz-primary-soft' : 'hover:bg-rz-canvas'
                )}
              >
                <PersonAvatar name={person.name} url={avatarOf(person.user_id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{person.name}</span>
                  <span className="block truncate text-[12px] text-rz-muted">
                    {[person.companyName, person.department].filter(Boolean).join(' · ') ||
                      'Sem empresa'}
                    {!person.email && ' · sem email'}
                  </span>
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
                    on ? 'bg-rz-primary text-white ring-rz-primary' : 'ring-rz-line'
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-[13px] text-rz-muted">Ninguém com isso.</li>
        )}
      </ul>
    </div>
  );
};
