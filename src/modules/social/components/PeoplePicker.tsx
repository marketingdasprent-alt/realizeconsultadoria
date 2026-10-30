import React, { useMemo, useState } from 'react';
import { matchesText } from '@/lib/text';
import { Check, Plus, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useDirectory } from '../hooks/useDirectory';
import {
  PEOPLE_GROUP_LABEL,
  rankPeople,
  readRecentPeople,
  rememberRecentPerson,
} from '../lib/peopleRanking';

interface PeoplePickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Uma só pessoa (ex.: responsável) ou várias (participantes, convidados). */
  single?: boolean;
  /** Incluir o próprio utilizador na lista ("Eu"). */
  includeMe?: boolean;
  placeholder: string;
}

/** Escolher colegas da empresa: chips com as pessoas escolhidas + lista com pesquisa. */
export const PeoplePicker: React.FC<PeoplePickerProps> = ({
  value,
  onChange,
  single,
  includeMe,
  placeholder,
}) => {
  const { user } = useWorkspace();
  const { colleagues, nameOf } = useDirectory();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Recentes (escolhidas há pouco neste browser), depois o meu departamento, depois as outras.
  const [recent, setRecent] = useState(readRecentPeople);
  const sections = useMemo(() => {
    const me = includeMe
      ? [{ userId: user.userId, name: `${user.name} (eu)`, department: user.department }]
      : [];
    const others = colleagues
      .map(p => ({ userId: p.userId, name: p.name, department: p.department }))
      .filter(p => matchesText(query, p.name, p.department));
    const ranked = rankPeople(others, recent, user.department ?? null);
    const mine = me.filter(p => matchesText(query, p.name, p.department));
    return [...(mine.length ? [{ group: 'me' as const, people: mine }] : []), ...ranked];
  }, [colleagues, includeMe, query, user, recent]);

  const toggle = (id: string) => {
    if (!value.includes(id) && id !== user.userId) {
      rememberRecentPerson(id);
      setRecent(readRecentPeople());
    }
    if (single) {
      onChange(value[0] === id ? [] : [id]);
      setOpen(false);
    } else {
      onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map(id => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 rounded-full bg-rz-primary-soft py-1 pl-1 pr-2 text-[12.5px] font-semibold text-rz-primary"
        >
          <UserAvatar name={nameOf(id)} userId={id} size="xs" />
          {id === user.userId ? 'Eu' : nameOf(id)}
          <button type="button" onClick={() => toggle(id)} aria-label={`Retirar ${nameOf(id)}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-rz-canvas px-3 text-[12.5px] font-semibold text-rz-muted hover:text-rz-ink"
          >
            <Plus className="h-3.5 w-3.5" /> {value.length && single ? 'Trocar' : placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 rounded-2xl p-2 shadow-rz-pop">
          <label className="mb-1 flex h-9 items-center gap-2 rounded-xl bg-rz-canvas px-2.5 text-rz-muted">
            <Search className="h-4 w-4" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Procurar colega"
              className="w-full bg-transparent text-sm text-rz-ink outline-none"
            />
          </label>
          <ul className="rz-scroll max-h-60 overflow-y-auto">
            {sections.map(section => (
              <li key={section.group}>
                {section.group !== 'me' && (
                  <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-rz-muted">
                    {PEOPLE_GROUP_LABEL[section.group]}
                  </p>
                )}
                <ul>
                  {section.people.map(p => (
                    <li key={p.userId}>
                      <button
                        type="button"
                        onClick={() => toggle(p.userId)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13.5px] hover:bg-rz-canvas',
                          value.includes(p.userId) && 'bg-rz-primary-soft'
                        )}
                      >
                        <UserAvatar name={p.name} userId={p.userId} size="xs" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                        {value.includes(p.userId) && <Check className="h-4 w-4 text-rz-primary" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
};
