import React from 'react';
import { Check, CheckCircle2, Forward, Paperclip, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { formatMailDate, nameOf } from '../lib/mailFormat';
import { endMailDrag, startMailDrag } from '../lib/mailDrag';
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
  /** Duplo clique na linha: abre o email numa janela própria. */
  onOpenWindow?: (mail: MailSummary) => void;
  /** Marcar/desmarcar (`range`: Shift+clique, intervalo desde o último). */
  onSelect: (mail: MailSummary, range: boolean) => void;
  onToggleStar: (mail: MailSummary) => void;
  onTrash: (mail: MailSummary) => void;
  /** Rato em cima (null ao sair): pré-carrega o email. */
  onHover?: (mail: MailSummary | null) => void;
  /** Envolve a linha (ex.: no menu do clique direito). */
  wrap?: (row: React.ReactElement) => React.ReactElement;
  /** Marcadores do email (etiquetas coloridas). */
  chips?: React.ReactNode;
  /** Emails que se arrastam com esta linha (ela, ou todos os selecionados se for um deles). */
  dragGroup?: MailSummary[];
  /** ✓ de um clique ("Tratado"): já está tratado? e o que fazer ao carregar. */
  quickDone?: { done: boolean; name: string; onToggle: () => void };
}

// No rato, o lixo e a caixa de seleção só aparecem ao passar por cima; no toque estão sempre.
const ON_HOVER =
  'focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100';

const doneLabel = (quick: { done: boolean; name: string }) =>
  quick.done ? `Tirar “${quick.name}”` : `Marcar como ${quick.name.toLowerCase()}`;

/** Uma linha da lista: seleção, remetente, assunto, excerto, data, lixo, estrela e anexos. */
export const MailListItem: React.FC<MailListItemProps> = ({ mail, ...props }) => {
  const stop = (event: React.MouseEvent, run: () => void) => {
    event.stopPropagation();
    run();
  };
  const checkbox = props.isSelected || props.selecting;
  // Rascunhos não têm remetente: mostra-se para quem é (como no Outlook).
  const who = mail.from
    ? nameOf(mail.from)
    : mail.to.length
      ? `Para ${mail.to.map(nameOf).join(', ')}`
      : '(rascunho sem destinatário)';
  const row = (
    <div
      role="button"
      tabIndex={0}
      draggable={!!props.dragGroup}
      onDragStart={event => props.dragGroup && startMailDrag(event, props.dragGroup)}
      onDragEnd={endMailDrag}
      onClick={() => props.onOpen(mail)}
      onDoubleClick={event => {
        // Duplo clique na estrela, no lixo ou na seleção não abre nada.
        if ((event.target as Element).closest('button')) return;
        props.onOpenWindow?.(mail);
      }}
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
          <UserAvatar name={who} size="md" />
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
            {who}
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
          {mail.forwarded && (
            <span title="Reencaminhado" className="shrink-0 text-rz-primary">
              <Forward className="h-3.5 w-3.5" aria-label="Reencaminhado" />
            </span>
          )}
          {mail.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-rz-muted" />}
          {props.quickDone && (
            <button
              type="button"
              onClick={event => stop(event, props.quickDone?.onToggle ?? (() => undefined))}
              className={cn(
                'shrink-0',
                props.quickDone.done
                  ? 'text-emerald-600'
                  : cn('text-rz-muted hover:text-emerald-600', ON_HOVER)
              )}
              aria-label={doneLabel(props.quickDone)}
              title={doneLabel(props.quickDone)}
            >
              <CheckCircle2 className={cn('h-4 w-4', props.quickDone.done && 'fill-emerald-100')} />
            </button>
          )}
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
        {props.chips && <div className="mt-0.5">{props.chips}</div>}
        <p className="truncate text-[12.5px] text-rz-muted">{mail.snippet}</p>
      </div>
      {mail.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rz-primary" />}
    </div>
  );
  return <li>{props.wrap ? props.wrap(row) : row}</li>;
};
