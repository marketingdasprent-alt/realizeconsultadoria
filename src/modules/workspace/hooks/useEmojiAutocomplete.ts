import { useCallback, useState } from 'react';
import type React from 'react';
import { emojiQueryAt, insertEmoji, searchEmojis } from '@/lib/emojiShortcodes';

type Field = HTMLTextAreaElement | HTMLInputElement;

interface Options {
  value: string;
  onChange: (value: string) => void;
  fieldRef: React.RefObject<Field>;
}

/**
 * Emojis por nome, como no WhatsApp: ":so" abre a lista; ↑ ↓ escolhem, Enter/Tab inserem e Esc
 * fecha. Usar `onKeyDown` antes do Enter que envia (se devolver true, a tecla já foi tratada).
 */
export const useEmojiAutocomplete = ({ value, onChange, fieldRef }: Options) => {
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const suggestions = query ? searchEmojis(query.query) : [];
  const open = suggestions.length > 0;

  /** Volta a ver o que está antes do cursor (depois de escrever ou mexer o cursor). */
  const update = useCallback(
    (text = value) => {
      const field = fieldRef.current;
      const caret = field?.selectionStart ?? text.length;
      setQuery(emojiQueryAt(text, caret));
      setActive(0);
    },
    [value, fieldRef]
  );

  const pick = (index: number) => {
    const field = fieldRef.current;
    const chosen = suggestions[index];
    if (!query || !chosen) return;
    const caret = field?.selectionStart ?? value.length;
    const next = insertEmoji(value, query.start, caret, chosen.emoji);
    onChange(next.text);
    setQuery(null);
    // O cursor fica logo a seguir ao emoji.
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent): boolean => {
    if (!open) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(index => (index + step + suggestions.length) % suggestions.length);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(active);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setQuery(null);
      return true;
    }
    return false;
  };

  return {
    suggestions,
    active,
    open,
    update,
    pick,
    onKeyDown,
    setActive,
    close: () => setQuery(null),
  };
};
