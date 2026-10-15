import React from 'react';
import { Paperclip, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { formatMailDate, nameOf } from '../lib/mailFormat';
import type { MailSummary } from '../types';

interface MailListItemProps {
  mail: MailSummary;
  isActive: boolean;
  /** Cor da caixa (só na vista unificada). */
  accountDot?: string;
  onOpen: (mail: MailSummary) => void;
  onToggleStar: (mail: MailSummary) => void;
  /** Rato em cima (null ao sair): pré-carrega o email. */
  onHover?: (mail: MailSummary | null) => void;
}

/** Uma linha da lista: remetente, assunto, excerto, data, estrela e anexos. */
export const MailListItem: React.FC<MailListItemProps> = ({
  mail,
  isActive,
  accountDot,
  onOpen,
  onToggleStar,
  onHover,
}) => (
  <li>
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(mail)}
      onMouseEnter={() => onHover?.(mail)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={event => event.key === 'Enter' && onOpen(mail)}
      className={cn(
        'flex cursor-pointer gap-3 rounded-2xl px-3 py-3 transition-colors',
        isActive ? 'bg-rz-primary-soft' : 'hover:bg-rz-canvas'
      )}
    >
      <UserAvatar name={nameOf(mail.from)} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {accountDot && <span className={cn('h-2 w-2 shrink-0 rounded-full', accountDot)} />}
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
            onClick={event => {
              event.stopPropagation();
              onToggleStar(mail);
            }}
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
