import React from 'react';
import { cn } from '@/lib/utils';

interface EmojiSuggestionsProps {
  suggestions: { emoji: string; name: string }[];
  active: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
  className?: string;
}

/** Lista de emojis por cima da caixa de texto (":so" → 😊 sorriso…). */
export const EmojiSuggestions: React.FC<EmojiSuggestionsProps> = ({
  suggestions,
  active,
  onPick,
  onHover,
  className,
}) =>
  suggestions.length ? (
    <ul
      role="listbox"
      aria-label="Emojis"
      className={cn(
        'absolute bottom-full left-0 z-50 mb-2 max-h-72 w-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-rz-pop ring-1 ring-rz-line',
        className
      )}
    >
      {suggestions.map((item, index) => (
        <li key={item.emoji} role="option" aria-selected={index === active}>
          <button
            type="button"
            // mousedown: escolhe antes de a caixa de texto perder o foco.
            onMouseDown={event => {
              event.preventDefault();
              onPick(index);
            }}
            onMouseEnter={() => onHover(index)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left',
              index === active && 'bg-rz-primary-soft'
            )}
          >
            <span className="text-[22px] leading-none">{item.emoji}</span>
            <span className="truncate text-[13px] font-medium text-rz-ink">:{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;
