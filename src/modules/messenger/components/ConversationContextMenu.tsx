import React, { useState } from 'react';
import {
  AppWindow,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  Folder,
  Link2,
  Mail,
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
import {
  PersonAccessDialog,
  type PersonAccessTab,
} from '@/modules/workspace/components/PersonAccessDialog';
import { prefetchPersonAccess } from '@/modules/workspace/lib/personAccessQuery';
import { useIsAdmin } from '@/modules/workspace/hooks/useIsAdmin';
import { useQueryClient } from '@tanstack/react-query';
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
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [access, setAccess] = useState<PersonAccessTab | null>(null);
  // Opções de admin: numa conversa privada, dar acessos à pessoa do outro lado
  const person =
    isAdmin && conversation.kind === 'direct' && conversation.peerUserId
      ? { userId: conversation.peerUserId, name: conversation.title }
      : null;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(conversationLink(conversation.id));
      toast({ title: 'Link copiado' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <>
      <ContextMenu
        onOpenChange={open => open && person?.userId && prefetchPersonAccess(qc, person?.userId)}
      >
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
          {person && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => setAccess('mail')} className="gap-2">
                <Mail className={ICON} /> Dar acesso a caixa de email…
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => setAccess('folders')} className="gap-2">
                <Folder className={ICON} /> Dar acesso a pasta…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <PersonAccessDialog
        person={access ? person : null}
        tab={access ?? 'folders'}
        onClose={() => setAccess(null)}
      />
    </>
  );
};
