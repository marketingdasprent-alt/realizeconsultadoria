import React from 'react';
import { cn } from '@/lib/utils';

interface MailSearchScopeProps {
  /** Pesquisa em todas as pastas (senão, só na pasta aberta). */
  allFolders: boolean;
  onAllFolders: (value: boolean) => void;
  /** Também no texto dos emails (mais lento). */
  includeBody: boolean;
  onIncludeBody: (value: boolean) => void;
  /** Ainda falta escrever para pesquisar em todas as pastas (menos de 2 letras). */
  tooShort: boolean;
  /** Nome da pasta aberta, para a primeira opção. */
  folderLabel: string;
}

const OPTION =
  'flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary/40';

/**
 * Por baixo da pesquisa: onde procurar (a pasta aberta ou todas as pastas) e, em todas as
 * pastas, se também se procura no texto dos emails.
 */
export const MailSearchScope: React.FC<MailSearchScopeProps> = props => (
  <div className="space-y-1.5">
    <div
      role="radiogroup"
      aria-label="Onde pesquisar"
      className="flex w-fit max-w-full rounded-full bg-rz-canvas p-1"
    >
      {[
        { value: false, label: props.folderLabel },
        { value: true, label: 'Todas as pastas' },
      ].map(option => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={props.allFolders === option.value}
          onClick={() => props.onAllFolders(option.value)}
          className={cn(
            OPTION,
            'min-w-0',
            props.allFolders === option.value
              ? 'bg-white text-rz-ink shadow-sm'
              : 'text-rz-muted hover:text-rz-ink'
          )}
        >
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
    {props.allFolders && (
      <>
        <label className="flex min-h-9 cursor-pointer items-center gap-2 px-1 text-[12.5px] text-rz-muted">
          <input
            type="checkbox"
            checked={props.includeBody}
            onChange={event => props.onIncludeBody(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-rz-line accent-[hsl(var(--rz-primary))]"
          />
          <span>
            Incluir o texto dos emails <span className="text-rz-muted/80">(mais lento)</span>
          </span>
        </label>
        {props.tooShort && (
          <p className="px-1 text-[12.5px] text-rz-muted">
            Escreva pelo menos 2 letras para pesquisar em todas as pastas.
          </p>
        )}
      </>
    )}
  </div>
);
