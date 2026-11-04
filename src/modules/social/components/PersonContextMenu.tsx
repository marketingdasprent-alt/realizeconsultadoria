import React, { useState } from 'react';
import { AppWindow, Folder, Mail, MessageCircle, User } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  PersonAccessDialog,
  type PersonAccessTab,
} from '@/modules/workspace/components/PersonAccessDialog';
import { prefetchPersonAccess } from '@/modules/workspace/lib/personAccessQuery';
import { useIsAdmin } from '@/modules/workspace/hooks/useIsAdmin';
import { useQueryClient } from '@tanstack/react-query';

interface PersonContextMenuProps {
  person: { userId: string; name: string };
  /** Endereço do perfil (para abrir e para abrir em nova janela). */
  profilePath: string;
  onOpenProfile: () => void;
  onMessage: () => void;
  /** O cartão da pessoa. */
  children: React.ReactElement;
}

const ICON = 'h-4 w-4';

/** Clique direito (ou toque longo) num colaborador: perfil, mensagem e, para admins, acessos. */
export const PersonContextMenu: React.FC<PersonContextMenuProps> = ({
  person,
  profilePath,
  onOpenProfile,
  onMessage,
  children,
}) => {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [access, setAccess] = useState<PersonAccessTab | null>(null);

  return (
    <>
      <ContextMenu
        onOpenChange={open =>
          open && isAdmin && person.userId && prefetchPersonAccess(qc, person.userId)
        }
      >
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-60 rounded-xl">
          <ContextMenuItem onSelect={onOpenProfile} className="gap-2">
            <User className={ICON} /> Ver perfil
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              window.open(`${window.location.origin}${profilePath}`, '_blank', 'noopener')
            }
            className="gap-2"
          >
            <AppWindow className={ICON} /> Abrir perfil em nova janela
          </ContextMenuItem>
          <ContextMenuItem onSelect={onMessage} className="gap-2">
            <MessageCircle className={ICON} /> Enviar mensagem
          </ContextMenuItem>
          {isAdmin && (
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
      {isAdmin && (
        <PersonAccessDialog
          person={access ? person : null}
          tab={access ?? 'folders'}
          onClose={() => setAccess(null)}
        />
      )}
    </>
  );
};
