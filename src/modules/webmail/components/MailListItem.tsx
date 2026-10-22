import React from 'react';
import { Check, Paperclip, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { formatMailDate, nameOf } from '../lib/mailFormat';
import type { MailSummary } from '../types';

interface MailListItemProps {
  mail: MailSummary;
  isActive: boolean;
  isSelected: boolean;
  /** Há emails selecionados: todas as linhas mostram a caixa de seleção. */
  selecting: boolean;
  /** Cor da caixa (só na vista unificada). */
  accountDot?: string;
  /** Nome da caixa (ao passar o rato na marca de cor). */
  accountName?: string;
  onOpen: (mail: MailSummary) => void;
  /** Marcar/desmarcar (`range`: Shift+clique, intervalo desde o último). */
  onSelect: (mail: MailSummary, range: boolean) => void;
  onToggleStar: (mail: MailSummary) => void;
  onTrash: (mail: MailSummary) => void;
  /** Rato em cima (null ao sair): pré-carrega o email. */
  onHover?: (mail: MailSummary | null) => void;
}

// No rato, o lixo e a caixa de seleção só aparecem ao passar por cima; no toque estão sempre.
const ON_HOVER =
  'focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100';

/** Uma linha da lista: seleção, remetente, assunto, excerto, data, lixo, estrela e anexos. */
export const MailListItem: React.FC<MailListItemProps> = ({ mail, ...props }) => {
  const stop = (event: React.MouseEvent, run: () => void) => {
    event.stopPropagation();
    run();
  };
  const checkbox = props.isSelected || props.selecting;
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => props.onOpen(mail)}
        onMouseEnter={() => props.onHover?.(mail)}
        onMouseLeave={() => props.onHover?.(null)}
        onKeyDown={event => event.key === 'Enter' && props.onOpen(mail)}
        className={cn(
          'group flex cursor-pointer gap-3 rounded-2xl px-3 py-3 transition-colors',
          props.isActive || props.isSelected ? 'bg-rz-primary-soft' : 'hover:bg-rz-canvas'
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={props.isSelected}
          aria-label={`Selecionar ${mail.subject || 'email'}`}
          onClick={event => stop(event, () => props.onSelect(mail, event.shiftKey))}
          // Shift+clique não seleciona o texto da lista.
          onMouseDown={event => event.shiftKey && event.preventDefault()}
          className="relative h-11 w-11 shrink-0 rounded-full"
        >
          <span
            className={cn(
              'block',
              checkbox ? 'invisible' : '[@media(hover:hover)]:group-hover:invisible'
            )}
          >
            <UserAvatar name={nameOf(mail.from)} size="md" />
          </span>
          <span
            className={cn(
              'absolute inset-0 items-center justify-center',
              checkbox ? 'flex' : 'hidden [@media(hover:hover)]:group-hover:flex'
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md border-2',
                props.isSelected
                  ? 'border-rz-primary bg-rz-primary text-white'
                  : 'border-rz-muted/60 bg-white'
              )}
            >
              {props.isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {props.accountDot && (
              // Barra (e não bolinha) para não se confundir com o sinal de "por ler".
              <span
                title={props.accountName}
                aria-label={props.accountName ? `Caixa ${props.accountName}` : undefined}
                className={cn('h-3.5 w-1 shrink-0 rounded-full', props.accountDot)}
              />
            )}
            <span
              className={cn(
                'flex-1 truncate text-[14px]',
                mail.unread ? 'font-extrabold' : 'font-semibold'
              )}
            >
              {nameOf(mail.from)}
            </span>
            <span
              className={cn(
                'shrink-0 text-[12px]',
                mail.unread ? 'font-bold text-rz-primary' : 'text-rz-muted'
              )}
            >
              {formatMailDate(mail.date)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'flex-1 truncate text-[13.5px]',
                mail.unread ? 'font-bold text-rz-ink' : 'text-rz-ink/90'
              )}
            >
              {mail.subject || '(sem assunto)'}
            </span>
            {mail.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-rz-muted" />}
            <button
              type="button"
              onClick={event => stop(event, () => props.onTrash(mail))}
              className={cn('shrink-0 text-rz-muted hover:text-rose-600', ON_HOVER)}
              aria-label="Mover para o lixo"
              title="Mover para o lixo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={event => stop(event, () => props.onToggleStar(mail))}
              className="shrink-0"
              aria-label={mail.starred ? 'Tirar estrela' : 'Pôr estrela'}
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  mail.starred ? 'fill-amber-400 text-amber-400' : 'text-rz-line'
                )}
              />
            </button>
          </div>
          <p className="truncate text-[12.5px] text-rz-muted">{mail.snippet}</p>
        </div>
        {mail.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rz-primary" />}
      </div>
    </li>
  );
};
