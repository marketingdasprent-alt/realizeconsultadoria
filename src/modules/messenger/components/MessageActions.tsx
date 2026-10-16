import React from 'react';
import {
  Copy,
  Forward,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { QUICK_REACTIONS } from '../lib/emojis';
import type { ChatMessage } from '../types';

export interface MessageActionHandlers {
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
  onCreateTask: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
}

const BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-primary';

/** Barra de ações de uma mensagem: responder, reagir e mais (copiar, editar, eliminar). */
export const MessageActions: React.FC<{ message: ChatMessage } & MessageActionHandlers> = ({
  message,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
  onCreateTask,
  onForward,
}) => (
  <div
    className={cn(
      'flex items-center gap-0.5 rounded-full bg-white p-0.5 shadow-rz-soft ring-1 ring-rz-line',
      'opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'
    )}
  >
    <button
      type="button"
      className={BUTTON}
      onClick={() => onReply(message)}
      aria-label="Responder"
    >
      <Reply className="h-4 w-4" />
    </button>
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={BUTTON} aria-label="Reagir">
          <SmilePlus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="flex w-auto gap-1 rounded-full p-1.5 shadow-rz-pop">
        {QUICK_REACTIONS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(message, emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-rz-canvas"
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={BUTTON} aria-label="Mais ações">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={message.isMine ? 'end' : 'start'}
        className="w-52 rounded-2xl p-1.5"
      >
        {message.text && (
          <DropdownMenuItem className="rounded-xl" onClick={() => onCopy(message)}>
            <Copy className="mr-2 h-4 w-4" /> Copiar texto
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="rounded-xl" onClick={() => onForward(message)}>
          <Forward className="mr-2 h-4 w-4" /> Encaminhar
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl" onClick={() => onCreateTask(message)}>
          <ListChecks className="mr-2 h-4 w-4" /> Criar tarefa
        </DropdownMenuItem>
        {message.isMine && (
          <>
            <DropdownMenuSeparator />
            {message.kind === 'text' && (
              <DropdownMenuItem className="rounded-xl" onClick={() => onEdit(message)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="rounded-xl text-rose-600 focus:text-rose-600"
              onClick={() => onDelete(message)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
