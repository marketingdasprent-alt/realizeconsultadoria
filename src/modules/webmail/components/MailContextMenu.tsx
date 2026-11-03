import React, { useState } from 'react';
import {
  AppWindow,
  CalendarPlus,
  Copy,
  ExternalLink,
  Forward,
  ListChecks,
  Mail,
  MailOpen,
  Printer,
  Reply,
  ReplyAll,
  Star,
  Trash2,
  Workflow,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useAccountFolders } from '../hooks/useAccountFolders';
import { useFolderActions, type MoveTarget } from '../hooks/useFolderActions';
import type { MailChange } from '../hooks/useMailChanges';
import { mailLink } from '../lib/mailLink';
import type { MailAccount, MailSummary } from '../types';
import type { ReaderAction } from './MailReader';
import { MailMoveSubmenu } from './MailMoveSubmenu';
import { NewMailFolderDialog } from './NewMailFolderDialog';

/** O que se pode fazer a um email pelo menu sem o abrir primeiro à mão. */
export type ListMailAction = Extract<
  ReaderAction,
  'reply' | 'replyAll' | 'forward' | 'task' | 'event' | 'print'
>;

interface MailContextMenuProps {
  mail: MailSummary;
  /** O que o menu atua: o email, ou os selecionados se ele for um deles (todos da mesma caixa). */
  targets: MailSummary[];
  accounts: MailAccount[];
  onOpen: (mail: MailSummary) => void;
  onChange: (mails: MailSummary[], kind: MailChange) => void;
  onMove: (mails: MailSummary[], target: MoveTarget) => void;
  /** Responder, reencaminhar, criar tarefa/evento, imprimir (abre o email e faz a ação). */
  onAction?: (mail: MailSummary, action: ListMailAction) => void;
  /** "Criar regra para este remetente…". */
  onRule?: (mail: MailSummary) => void;
  /** A linha. */
  children: React.ReactElement;
}

const ICON = 'h-4 w-4';

/** Clique direito (ou toque longo) num email: responder, tarefa/evento, mover, regras, lixo. */
export const MailContextMenu: React.FC<MailContextMenuProps> = ({
  mail,
  targets,
  accounts,
  onOpen,
  onChange,
  onMove,
  onAction,
  onRule,
  children,
}) => {
  const { isPreview } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { create } = useFolderActions();
  const folders = useAccountFolders(menuOpen ? mail.accountId : null);
  const many = targets.length > 1;
  const allStarred = targets.every(m => m.starred);
  const allRead = targets.every(m => !m.unread);

  const act = (action: ListMailAction) => onAction?.(mail, action);
  const copySender = async () => {
    try {
      await navigator.clipboard.writeText(mail.from?.email ?? '');
      toast({ title: 'Endereço copiado', description: mail.from?.email });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <>
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-64 rounded-xl">
          {!many && (
            <>
              <ContextMenuItem onSelect={() => onOpen(mail)} className="gap-2">
                <ExternalLink className={ICON} /> Abrir
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => window.open(mailLink(mail), '_blank', 'noopener')}
                className="gap-2"
              >
                <AppWindow className={ICON} /> Abrir em nova janela
              </ContextMenuItem>
              {onAction && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => act('reply')} className="gap-2">
                    <Reply className={ICON} /> Responder
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => act('replyAll')} className="gap-2">
                    <ReplyAll className={ICON} /> Responder a todos
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => act('forward')} className="gap-2">
                    <Forward className={ICON} /> Reencaminhar
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => act('task')} className="gap-2">
                    <ListChecks className={ICON} /> Criar tarefa
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => act('event')} className="gap-2">
                    <CalendarPlus className={ICON} /> Criar evento
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => onChange(targets, allRead ? 'unread' : 'read')}
            className="gap-2"
          >
            {allRead ? <Mail className={ICON} /> : <MailOpen className={ICON} />}
            {allRead ? 'Marcar como não lido' : 'Marcar como lido'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => onChange(targets, allStarred ? 'unstar' : 'star')}
            className="gap-2"
          >
            <Star className={ICON} /> {allStarred ? 'Tirar estrela' : 'Pôr estrela'}
          </ContextMenuItem>
          {!isPreview && (
            <>
              <ContextMenuSeparator />
              <MailMoveSubmenu
                folders={folders.data ?? []}
                isLoading={folders.isLoading}
                onMove={target => onMove(targets, target)}
                onNewFolder={() => setCreating(true)}
              />
              {onRule && mail.from && !many && (
                <ContextMenuItem onSelect={() => onRule(mail)} className="gap-2">
                  <Workflow className={ICON} /> Criar regra para este remetente…
                </ContextMenuItem>
              )}
            </>
          )}
          {!many && (
            <>
              <ContextMenuSeparator />
              {mail.from && (
                <ContextMenuItem onSelect={() => void copySender()} className="gap-2">
                  <Copy className={ICON} /> Copiar endereço do remetente
                </ContextMenuItem>
              )}
              {onAction && (
                <ContextMenuItem onSelect={() => act('print')} className="gap-2">
                  <Printer className={ICON} /> Imprimir
                </ContextMenuItem>
              )}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => onChange(targets, 'trash')}
            className="gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
          >
            <Trash2 className={ICON} /> Mover para o lixo
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <NewMailFolderDialog
        open={creating}
        onClose={() => setCreating(false)}
        accounts={accounts}
        accountId={mail.accountId}
        onCreate={async (account, name, parent) => {
          const result = await create(account, name, parent);
          if (result.error || !result.id) return result.error;
          onMove(targets, { id: result.id, name });
          return null;
        }}
      />
    </>
  );
};
