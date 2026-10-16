import React from 'react';
import {
  Archive,
  ArrowLeft,
  Bell,
  BellOff,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ConversationSummary, MemberFlag } from '../types';
import { ConversationAvatar } from './ConversationAvatar';

interface ConversationHeaderProps {
  conversation: ConversationSummary;
  typing: string[];
  isSearching: boolean;
  onBack: () => void;
  onToggleSearch: () => void;
  onFlag: (flag: MemberFlag, value: boolean) => void;
  /** Só nos grupos: mudar o nome. */
  onRename?: () => void;
}

const ACTION =
  'flex h-10 w-10 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-primary';

const typingText = (names: string[]) =>
  names.length === 1 ? `${names[0]} está a escrever…` : `${names.join(', ')} estão a escrever…`;

/** Cabeçalho da conversa: quem é, estado, pesquisa e opções (fixar, silenciar, arquivar). */
export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  typing,
  isSearching,
  onBack,
  onToggleSearch,
  onFlag,
  onRename,
}) => (
  <header className="flex items-center gap-3 border-b border-rz-line bg-white/80 px-3 py-2.5 backdrop-blur md:px-5">
    <button type="button" onClick={onBack} className={`${ACTION} md:hidden`} aria-label="Voltar">
      <ArrowLeft className="h-5 w-5" />
    </button>
    <ConversationAvatar conversation={conversation} />
    <div className="min-w-0 flex-1">
      {onRename ? (
        <button
          type="button"
          onClick={onRename}
          className="group/title flex max-w-full items-center gap-1.5 text-left"
          title="Mudar o nome do grupo"
        >
          <span className="truncate text-[16px] font-bold">{conversation.title}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-rz-muted opacity-0 transition-opacity group-hover/title:opacity-100" />
        </button>
      ) : (
        <p className="truncate text-[16px] font-bold">{conversation.title}</p>
      )}
      <p className="truncate text-[12.5px] text-rz-muted">
        {typing.length > 0 ? (
          <span className="font-semibold text-rz-primary">{typingText(typing)}</span>
        ) : conversation.online ? (
          <span className="font-semibold text-emerald-600">Disponível</span>
        ) : (
          conversation.subtitle
        )}
      </p>
    </div>
    <button
      type="button"
      onClick={onToggleSearch}
      className={cn(ACTION, isSearching && 'bg-rz-primary-soft text-rz-primary')}
      aria-label="Procurar na conversa"
      aria-pressed={isSearching}
    >
      <Search className="h-[18px] w-[18px]" />
    </button>
    <button
      type="button"
      className={cn(ACTION, 'hidden sm:flex', conversation.pinned && 'text-rz-primary')}
      onClick={() => onFlag('pinned', !conversation.pinned)}
      aria-label={conversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
    >
      {conversation.pinned ? (
        <PinOff className="h-[18px] w-[18px]" />
      ) : (
        <Pin className="h-[18px] w-[18px]" />
      )}
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={ACTION} aria-label="Mais opções">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
        {onRename && (
          <DropdownMenuItem className="rounded-xl" onClick={onRename}>
            <Pencil className="mr-2 h-4 w-4" /> Mudar o nome do grupo
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="rounded-xl sm:hidden"
          onClick={() => onFlag('pinned', !conversation.pinned)}
        >
          <Pin className="mr-2 h-4 w-4" /> {conversation.pinned ? 'Desafixar' : 'Fixar conversa'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-xl"
          onClick={() => onFlag('muted', !conversation.muted)}
        >
          {conversation.muted ? (
            <Bell className="mr-2 h-4 w-4" />
          ) : (
            <BellOff className="mr-2 h-4 w-4" />
          )}
          {conversation.muted ? 'Ativar notificações' : 'Silenciar'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-xl"
          onClick={() => onFlag('archived', !conversation.archived)}
        >
          <Archive className="mr-2 h-4 w-4" />
          {conversation.archived ? 'Desarquivar' : 'Arquivar conversa'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </header>
);
