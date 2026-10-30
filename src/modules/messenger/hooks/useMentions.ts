import { useState, type KeyboardEvent, type RefObject } from 'react';
import {
  insertMention,
  mentionedIds,
  mentionQuery,
  mentionSuggestions,
  type MentionPerson,
} from '../lib/mentions';

interface UseMentionsOptions {
  value: string;
  onChange: (value: string) => void;
  fieldRef: RefObject<HTMLTextAreaElement>;
  /** Quem se pode marcar (os outros membros da conversa). */
  people: MentionPerson[];
}

/** "@an" → lista de colegas da conversa; Enter/Tab escolhe, setas mudam, Esc fecha. */
export const useMentions = ({ value, onChange, fieldRef, people }: UseMentionsOptions) => {
  const [open, setOpen] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<MentionPerson[]>([]);
  const suggestions = open && people.length ? mentionSuggestions(people, open.query) : [];

  const update = (text = value) => {
    const caret = fieldRef.current?.selectionStart ?? text.length;
    const next = mentionQuery(text, caret);
    setOpen(next);
    if (next?.query !== open?.query) setActive(0);
  };

  const pick = (index: number) => {
    const person = suggestions[index];
    if (!person || !open) return;
    const caret = fieldRef.current?.selectionStart ?? value.length;
    const next = insertMention(value, open.start, caret, person.name);
    onChange(next.text);
    setPicked(list => (list.some(p => p.userId === person.userId) ? list : [...list, person]));
    setOpen(null);
    requestAnimationFrame(() => {
      fieldRef.current?.focus();
      fieldRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  /** true se a tecla era para a lista (não envia a mensagem). */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggestions.length) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(current => (current + step + suggestions.length) % suggestions.length);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(active);
      return true;
    }
    if (event.key === 'Escape') {
      setOpen(null);
      return true;
    }
    return false;
  };

  return {
    suggestions,
    active,
    setActive,
    pick,
    update,
    onKeyDown,
    close: () => setOpen(null),
    /** Quem ficou marcado no texto a enviar. */
    mentionedIn: (text: string) => mentionedIds(text, picked, people),
    reset: () => setPicked([]),
  };
};
