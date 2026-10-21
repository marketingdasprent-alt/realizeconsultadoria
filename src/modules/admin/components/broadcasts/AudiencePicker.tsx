import React from 'react';
import { Building2, Network, UserCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  departmentsOf,
  type Audience,
  type AudienceMode,
  type BroadcastEmployee,
} from '../../lib/broadcast';
import { PeopleChooser } from './PeopleChooser';

const MODES: { value: AudienceMode; label: string; icon: typeof Users }[] = [
  { value: 'all', label: 'Todos', icon: Users },
  { value: 'company', label: 'Empresas', icon: Building2 },
  { value: 'department', label: 'Departamentos', icon: Network },
  { value: 'people', label: 'Pessoas', icon: UserCheck },
];

const CHIP =
  'rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition-colors disabled:opacity-50';

interface AudiencePickerProps {
  audience: Audience;
  onChange: (audience: Audience) => void;
  people: BroadcastEmployee[];
  companies: { id: string; name: string }[];
  error?: string;
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter(item => item !== value) : [...list, value];

/** Para quem: todos, empresas, departamentos ou pessoas escolhidas uma a uma. */
export const AudiencePicker: React.FC<AudiencePickerProps> = ({
  audience,
  onChange,
  people,
  companies,
  error,
}) => {
  const departments = departmentsOf(people);
  const chips = (
    items: { id: string; label: string }[],
    selected: string[],
    key: 'companyIds' | 'departments'
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const on = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange({ ...audience, [key]: toggle(selected, item.id) })}
            className={cn(
              CHIP,
              on
                ? 'bg-rz-primary text-white ring-rz-primary'
                : 'bg-white text-rz-ink ring-rz-line hover:bg-rz-primary-soft'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-rz-canvas p-1 sm:grid-cols-4">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...audience, mode: value })}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-semibold transition-colors',
              audience.mode === value
                ? 'bg-white text-rz-primary shadow-rz-soft'
                : 'text-rz-muted hover:text-rz-ink'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {audience.mode === 'company' &&
        chips(
          companies.map(c => ({ id: c.id, label: c.name })),
          audience.companyIds,
          'companyIds'
        )}
      {audience.mode === 'department' &&
        (departments.length ? (
          chips(
            departments.map(name => ({ id: name, label: name })),
            audience.departments,
            'departments'
          )
        ) : (
          <p className="text-[13px] text-rz-muted">Ainda não há departamentos nas fichas.</p>
        ))}
      {audience.mode === 'people' && (
        <PeopleChooser
          people={people}
          selected={audience.peopleIds}
          onChange={peopleIds => onChange({ ...audience, peopleIds })}
        />
      )}
      {error && <p className="text-[12.5px] font-medium text-rose-600">{error}</p>}
    </div>
  );
};
