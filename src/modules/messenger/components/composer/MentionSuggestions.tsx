import React from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { MentionPerson } from '../../lib/mentions';

interface MentionSuggestionsProps {
  suggestions: MentionPerson[];
  active: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}

/** Lista de colegas por cima da caixa de escrita ao escrever "@". */
export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
  suggestions,
  active,
  onPick,
  onHover,
}) =>
  suggestions.length ? (
    <ul
      role="listbox"
      aria-label="Marcar pessoa"
      className="absolute bottom-full left-2 z-50 mb-2 max-h-72 w-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-rz-pop ring-1 ring-rz-line"
    >
      <li className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-rz-muted">
        Marcar pessoa
      </li>
      {suggestions.map((person, index) => (
        <li key={person.userId} role="option" aria-selected={index === active}>
          <button
            type="button"
            // mousedown: escolhe antes de a caixa de texto perder o foco.
            onMouseDown={event => {
              event.preventDefault();
              onPick(index);
            }}
            onMouseEnter={() => onHover(index)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left',
              index === active && 'bg-rz-primary-soft'
            )}
          >
            <UserAvatar name={person.name} userId={person.userId} size="xs" />
            <span className="truncate text-[13.5px] font-semibold text-rz-ink">{person.name}</span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;
