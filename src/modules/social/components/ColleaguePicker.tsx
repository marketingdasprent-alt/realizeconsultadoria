import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compareText, matchesText } from '@/lib/text';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';

interface ColleaguePickerProps {
  people: DirectoryPerson[];
  value: string;
  onChange: (userId: string) => void;
}

/** Avatar, nome e "cargo · departamento". */
const PersonInfo: React.FC<{ person: DirectoryPerson; size: 'xs' | 'sm' }> = ({ person, size }) => {
  const details = [person.position, person.department].filter(Boolean).join(' · ');
  return (
    <>
      <UserAvatar name={person.name} userId={person.userId} size={size} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{person.name}</span>
        {details && <span className="block truncate text-[12px] text-rz-muted">{details}</span>}
      </span>
    </>
  );
};

/** Escolher um colega: pesquisa por nome, cargo ou departamento (sem acentos). */
export const ColleaguePicker: React.FC<ColleaguePickerProps> = ({ people, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = people.find(person => person.userId === value);
  const results = useMemo(
    () =>
      people
        .filter(person => matchesText(term, person.name, person.department, person.position))
        .sort((a, b) => compareText(a.name, b.name)),
    [people, term]
  );

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Esc fecha só a lista: o diálogo (Radix) ouve-o no document em captura; apanha-se antes.
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setIsOpen(false);
    };
    window.addEventListener('keydown', onEscape, { capture: true });
    return () => window.removeEventListener('keydown', onEscape, { capture: true });
  }, [isOpen]);

  const pick = (person: DirectoryPerson) => {
    onChange(person.userId);
    setTerm('');
    setIsOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') setActive(index => Math.min(index + 1, results.length - 1));
    else if (event.key === 'ArrowUp') setActive(index => Math.max(index - 1, 0));
    else if (event.key === 'Enter' && isOpen && results[active]) pick(results[active]);
    else return;
    event.preventDefault();
  };

  if (!isOpen && selected) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-rz-canvas p-2.5 pr-2">
        <PersonInfo person={selected} size="sm" />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-rz-primary hover:bg-rz-primary-soft"
        >
          Trocar
        </button>
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar colega"
          className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl',
        isOpen ? 'bg-white shadow-rz-pop ring-1 ring-rz-line' : 'bg-rz-canvas'
      )}
    >
      <div className={cn('flex items-center gap-2 px-3', isOpen && 'border-b border-rz-line')}>
        <Search className="h-4 w-4 shrink-0 text-rz-muted" />
        <input
          autoFocus={isOpen}
          value={term}
          onClick={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onChange={event => {
            setTerm(event.target.value);
            setActive(0);
            setIsOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={isOpen ? 'Procurar por nome, cargo ou departamento' : 'Escolha um colega…'}
          aria-label="Procurar colega"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-rz-muted"
        />
      </div>
      {isOpen && (
        <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
          {results.map((person, index) => (
            <li key={person.userId} role="option" aria-selected={person.userId === value}>
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => pick(person)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left',
                  index === active && 'bg-rz-primary-soft'
                )}
              >
                <PersonInfo person={person} size="xs" />
              </button>
            </li>
          ))}
          {!results.length && (
            <li className="py-6 text-center text-sm text-rz-muted">Sem resultados.</li>
          )}
        </ul>
      )}
    </div>
  );
};
