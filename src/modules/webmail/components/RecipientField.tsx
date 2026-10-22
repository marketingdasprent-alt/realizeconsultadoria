import React, { useMemo, useRef, useState } from 'react';
import { Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseRecipients } from '../lib/mailFormat';
import {
  addRecipients,
  recipientEmails,
  removeRecipient,
  suggestRecipients,
  type ContactEntry,
  type ContactList,
  type Suggestion,
} from '../lib/recipients';

interface RecipientFieldProps {
  /** "a@b.pt, c@d.pt" */
  value: string;
  onChange: (value: string) => void;
  /** Colegas da empresa. */
  team: ContactEntry[];
  /** Quem já recebeu emails desta pessoa. */
  contacts: ContactEntry[];
  lists: ContactList[];
  /** Nas próprias listas não se sugerem listas. */
  allowLists?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  label: string;
}

const CHIP =
  'inline-flex max-w-[16rem] items-center gap-1 rounded-full bg-rz-primary-soft py-0.5 pl-2.5 pr-1 text-[12.5px] font-semibold text-rz-primary';

/** Destinatários como etiquetas, com sugestões ao digitar (listas, equipa e quem já escreveu). */
export const RecipientField: React.FC<RecipientFieldProps> = ({
  value,
  onChange,
  team,
  contacts,
  lists,
  allowLists = true,
  autoFocus,
  placeholder,
  label,
}) => {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const emails = recipientEmails(value);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of [...team, ...contacts, ...lists.flatMap(list => list.members)])
      if (entry.name) map.set(entry.email.toLowerCase(), entry.name);
    return map;
  }, [team, contacts, lists]);

  const suggestions = useMemo(
    () => suggestRecipients({ query: draft, team, contacts, lists, exclude: emails, allowLists }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emails deriva de value
    [draft, team, contacts, lists, value, allowLists]
  );

  /** Passa o que está escrito a etiquetas (só emails válidos). */
  const commitDraft = () => {
    const valid = parseRecipients(draft);
    if (valid.length) {
      onChange(addRecipients(value, valid));
      setDraft('');
    }
  };

  const choose = (suggestion: Suggestion) => {
    onChange(
      addRecipients(value, suggestion.kind === 'list' ? suggestion.emails : [suggestion.email])
    );
    setDraft('');
    setHighlight(0);
    input.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const picked = open ? suggestions[highlight] : undefined;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight(index => (index + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      // Escolhe a sugestão marcada só se se escreveu algo; senão deixa seguir.
      if (picked && draft.trim()) {
        event.preventDefault();
        choose(picked);
      } else if (parseRecipients(draft).length) {
        event.preventDefault();
        commitDraft();
      } else if (event.key === 'Enter') {
        event.preventDefault();
      }
    } else if (event.key === ',' || event.key === ';') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Backspace' && !draft && emails.length) {
      onChange(removeRecipient(value, emails[emails.length - 1]));
    }
  };

  return (
    <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1.5">
      {emails.map(email => (
        <span key={email} className={CHIP} title={email}>
          <span className="truncate">{names.get(email) ?? email}</span>
          <button
            type="button"
            onClick={() => onChange(removeRecipient(value, email))}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white"
            aria-label={`Retirar ${email}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={input}
        value={draft}
        onChange={event => {
          setDraft(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          commitDraft();
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
        onPaste={event => {
          const text = event.clipboardData.getData('text');
          if (!/[,;\n]/.test(text)) return;
          event.preventDefault();
          onChange(addRecipients(value, parseRecipients(text)));
        }}
        autoFocus={autoFocus}
        placeholder={emails.length ? undefined : placeholder}
        aria-label={label}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        className="h-8 min-w-[8rem] flex-1 bg-transparent text-[14px] outline-none placeholder:text-rz-muted"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[16rem] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-rz-pop ring-1 ring-rz-line"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.key} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                // mousedown: escolhe antes de o campo perder o foco (que fecharia a lista)
                onMouseDown={event => {
                  event.preventDefault();
                  choose(suggestion);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left',
                  index === highlight && 'bg-rz-primary-soft'
                )}
              >
                {suggestion.kind === 'list' ? (
                  <>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rz-primary text-white">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">
                        {suggestion.name}
                      </span>
                      <span className="block text-[12px] text-rz-muted">
                        Lista · {suggestion.emails.length}{' '}
                        {suggestion.emails.length === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rz-canvas text-[12px] font-bold text-rz-primary">
                      {(suggestion.name ?? suggestion.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">
                        {suggestion.name ?? suggestion.email}
                      </span>
                      {suggestion.name && (
                        <span className="block truncate text-[12px] text-rz-muted">
                          {suggestion.email}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-rz-canvas px-2 py-0.5 text-[11px] font-semibold text-rz-muted">
                      {suggestion.source === 'team' ? 'Equipa' : 'Já enviado'}
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
