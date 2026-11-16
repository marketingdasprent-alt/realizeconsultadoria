import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Mail,
  MailOpen,
  Minus,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { MailChange } from '../hooks/useMailChanges';

interface MailBulkBarProps {
  count: number;
  allSelected: boolean;
  /** Todos os selecionados já têm estrela: o botão passa a tirá-la. */
  allStarred: boolean;
  hasMessages: boolean;
  /** Quantos emails por ler há na lista (carregada). */
  unreadCount: number;
  onToggleAll: () => void;
  /** Seleciona só os emails por ler. */
  onSelectUnread: () => void;
  onAction: (kind: MailChange) => void;
  onClear: () => void;
  /** Botão "Mover para…" (só quando os selecionados são todos da mesma caixa). */
  moveSlot?: React.ReactNode;
  /** O que aparece sem nada selecionado (a pesquisa). */
  children: React.ReactNode;
}

const ICON_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink';

/**
 * "N selecionados". A lista é estreita e, com todos os botões de ação, nem sempre o texto cabe:
 * quando não cabe, mostra só o número (o texto completo fica para leitores de ecrã e no balão).
 */
const SelectionCount: React.FC<{ count: number }> = ({ count }) => {
  const box = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  const text = count === 1 ? '1 selecionado' : `${count} selecionados`;

  useLayoutEffect(() => {
    const area = box.current;
    const twin = full.current;
    if (!area || !twin) return;
    // O texto completo mede-se numa cópia invisível, para o espaço não depender do que se mostra.
    const measure = () => setFits(area.clientWidth >= twin.offsetWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span
      ref={box}
      className="relative flex h-9 min-w-0 flex-1 items-center text-[13.5px] font-bold"
      aria-live="polite"
      title={text}
    >
      <span className="sr-only">{text}</span>
      <span ref={full} aria-hidden className="invisible absolute left-0 whitespace-nowrap">
        {text}
      </span>
      <span aria-hidden className="truncate">
        {fits ? text : count}
      </span>
    </span>
  );
};

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
      {/* Escolher o que selecionar, como no Gmail e no Outlook: todos, só os não lidos ou nenhum. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!props.hasMessages}
            aria-label="Escolher o que selecionar"
            title="Escolher o que selecionar"
            className="-ml-1.5 flex h-9 w-6 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink disabled:opacity-40"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-xl">
          <DropdownMenuItem onSelect={() => !props.allSelected && props.onToggleAll()}>
            Todos
          </DropdownMenuItem>
          <DropdownMenuItem disabled={props.unreadCount === 0} onSelect={props.onSelectUnread}>
            {props.unreadCount === 0 ? 'Não lidos (nenhum)' : `Não lidos (${props.unreadCount})`}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!some} onSelect={props.onClear}>
            Nenhum
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {some ? (
        <>
          <SelectionCount count={props.count} />
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
          {props.moveSlot}
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
