import React from 'react';
import {
  AppWindow,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  Link2,
  MessageSquare,
  Pin,
  PinOff,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/hooks/use-toast';
import { useMessengerApi } from '../context/useMessengerApi';
import type { ConversationSummary } from '../types';

interface ConversationContextMenuProps {
  conversation: ConversationSummary;
  onOpen: (id: string) => void;
  /** A linha da conversa. */
  children: React.ReactElement;
}

const ICON = 'h-4 w-4';

/** Link do Mensagens com esta conversa aberta (?c=id). */
const conversationLink = (id: string) =>
  `${window.location.origin}${window.location.pathname}?${new URLSearchParams({ c: id }).toString()}`;

/** Clique direito (ou toque longo) numa conversa: abrir, nova janela, lida, fixar, silenciar, arquivar. */
export const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  conversation,
  onOpen,
  children,
}) => {
  const api = useMessengerApi();
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(conversationLink(conversation.id));
      toast({ title: 'Link copiado' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60 rounded-xl">
        <ContextMenuItem onSelect={() => onOpen(conversation.id)} className="gap-2">
          <MessageSquare className={ICON} /> Abrir conversa
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => window.open(conversationLink(conversation.id), '_blank', 'noopener')}
          className="gap-2"
        >
          <AppWindow className={ICON} /> Abrir em nova janela
        </ContextMenuItem>
        <ContextMenuSeparator />
        {conversation.unread > 0 && (
          <ContextMenuItem onSelect={() => void api.markRead(conversation.id)} className="gap-2">
            <CheckCheck className={ICON} /> Marcar como lida
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onSelect={() => void api.setFlag(conversation.id, 'pinned', !conversation.pinned)}
          className="gap-2"
        >
          {conversation.pinned ? <PinOff className={ICON} /> : <Pin className={ICON} />}
          {conversation.pinned ? 'Desafixar' : 'Fixar no topo'}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void api.setFlag(conversation.id, 'muted', !conversation.muted)}
          className="gap-2"
        >
          {conversation.muted ? <Bell className={ICON} /> : <BellOff className={ICON} />}
          {conversation.muted ? 'Ativar notificações' : 'Silenciar'}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void api.setFlag(conversation.id, 'archived', !conversation.archived)}
          className="gap-2"
        >
          {conversation.archived ? (
            <ArchiveRestore className={ICON} />
          ) : (
            <Archive className={ICON} />
          )}
          {conversation.archived ? 'Desarquivar' : 'Arquivar'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void copyLink()} className="gap-2">
          <Link2 className={ICON} /> Copiar link da conversa
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
