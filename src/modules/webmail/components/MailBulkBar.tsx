import React from 'react';
import { Check, Mail, MailOpen, Minus, Star, Trash2, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MailChange } from '../hooks/useMailChanges';

interface MailBulkBarProps {
  count: number;
  allSelected: boolean;
  /** Todos os selecionados já têm estrela: o botão passa a tirá-la. */
  allStarred: boolean;
  hasMessages: boolean;
  onToggleAll: () => void;
  onAction: (kind: MailChange) => void;
  onClear: () => void;
  /** O que aparece sem nada selecionado (a pesquisa). */
  children: React.ReactNode;
}

const ICON_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink';

/**
 * Seleção na lista: a caixa "selecionar todos os desta página" e, com emails selecionados,
 * as ações em grupo no lugar da pesquisa.
 */
export const MailBulkBar: React.FC<MailBulkBarProps> = props => {
  const some = props.count > 0;
  const actions: { kind: MailChange; label: string; icon: LucideIcon }[] = [
    { kind: 'read', label: 'Marcar como lidos', icon: MailOpen },
    { kind: 'unread', label: 'Marcar como não lidos', icon: Mail },
    props.allStarred
      ? { kind: 'unstar', label: 'Tirar estrela', icon: Star }
      : { kind: 'star', label: 'Pôr estrela', icon: Star },
    { kind: 'trash', label: 'Mover para o lixo', icon: Trash2 },
  ];
  return (
    <div className="flex h-10 items-center gap-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={props.allSelected ? true : some ? 'mixed' : false}
        aria-label="Selecionar todos os desta página"
        title="Selecionar todos os desta página"
        onClick={props.onToggleAll}
        disabled={!props.hasMessages}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-rz-canvas disabled:opacity-40"
      >
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md border-2',
            some ? 'border-rz-primary bg-rz-primary text-white' : 'border-rz-muted/60 bg-white'
          )}
        >
          {props.allSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          {some && !props.allSelected && <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </button>
      {some ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" aria-live="polite">
            {props.count === 1 ? '1 selecionado' : `${props.count} selecionados`}
          </span>
          {actions.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => props.onAction(kind)}
              className={cn(ICON_BUTTON, kind === 'trash' && 'hover:text-rose-600')}
              aria-label={label}
              title={label}
            >
              <Icon
                className={cn('h-4 w-4', kind === 'unstar' && 'fill-amber-400 text-amber-400')}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={props.onClear}
            className={ICON_BUTTON}
            aria-label="Limpar seleção"
            title="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        props.children
      )}
    </div>
  );
};
