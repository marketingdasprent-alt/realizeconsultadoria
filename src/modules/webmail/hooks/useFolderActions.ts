import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mapPerGroup } from '../lib/concurrency';
import { mailErrorText, mailService, type MailError } from '../services/mailService';
import type { MailFolder, MailSummary } from '../types';
import { patchLists } from './useMailChanges';
import { bumpUnread, refreshUnreadSoon } from './useUnreadCounts';

/** Pedidos em simultâneo por caixa (o Microsoft Graph recusa mais de 4 na mesma caixa). */
const PER_ACCOUNT = 3;

export interface MoveTarget {
  id: string;
  name: string;
}

/** Pastas, listas, regras e marcadores guardam o id/nome da pasta: voltam a ler-se. */
const refreshAfterFolderChange = async (qc: QueryClient, accountId: string) => {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['mail', 'folders', accountId] }),
    qc.invalidateQueries({ queryKey: ['mail', 'rules', accountId] }),
    qc.invalidateQueries({ queryKey: ['mail', 'labels'] }),
    qc.invalidateQueries({ queryKey: ['mail', 'list'] }),
  ]);
};

const UNAVAILABLE: MailError = { code: 'unavailable', message: '' };

/**
 * Criar pastas e mover emails para elas. `folder`: a pasta à vista (os "por ler" contam só a
 * Entrada, por isso só aí se acertam já).
 */
export const useFolderActions = (folder?: MailFolder) => {
  const { user } = useWorkspace();
  const qc = useQueryClient();

  return {
    /** Cria a pasta; devolve o id da nova ou a mensagem de erro. */
    create: async (
      accountId: string,
      name: string,
      parentId: string | null
    ): Promise<{ id: string | null; error: string | null }> => {
      const { data, error } = await mailService.createFolder(accountId, name, parentId);
      if (error || !data) {
        return { id: null, error: mailErrorText(error) || 'A pasta não foi criada.' };
      }
      await qc.invalidateQueries({ queryKey: ['mail', 'folders', accountId] });
      return { id: data.id, error: null };
    },

    /** Muda o nome; devolve a mensagem de erro ou null. As regras e marcadores acompanham-na. */
    rename: async (accountId: string, folderId: string, name: string): Promise<string | null> => {
      const { error } = await mailService.renameFolder(accountId, folderId, name);
      if (error) return mailErrorText(error) || 'Não foi possível mudar o nome.';
      await refreshAfterFolderChange(qc, accountId);
      return null;
    },

    /** Apaga a pasta (e as subpastas); devolve a mensagem de erro ou null. */
    remove: async (accountId: string, folderId: string): Promise<string | null> => {
      const { error } = await mailService.deleteFolder(accountId, folderId);
      if (error) return mailErrorText(error) || 'Não foi possível apagar a pasta.';
      await refreshAfterFolderChange(qc, accountId);
      return null;
    },

    /** Move os emails (todos da mesma caixa) para a pasta: saem já da lista; o que falhar volta. */
    move: async (mails: MailSummary[], target: MoveTarget) => {
      if (!mails.length) return;
      mails.forEach(mail => {
        patchLists(qc, user.userId, mail, 'remove');
        if ((folder === 'inbox' || folder === 'unread') && mail.unread)
          bumpUnread(qc, mail.accountId, -1);
      });
      const results = await mapPerGroup(
        mails,
        mail => mail.accountId,
        PER_ACCOUNT,
        mail =>
          mailService.move(mail.accountId, mail.id, target.id).catch(() => ({ error: UNAVAILABLE }))
      );
      // Já não existe nesta caixa: sai da lista sem aviso de erro
      const errors = results
        .map(result => result.error)
        .filter((error): error is MailError => !!error && error.code !== 'message_not_found');
      if (errors.length) {
        void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
        toast({
          title: 'Não foi possível mover',
          description:
            `${errors.length === 1 ? '1 email ficou onde estava' : `${errors.length} emails ficaram onde estavam`}. ${mailErrorText(errors[0])}`.trim(),
          variant: 'destructive',
        });
      }
      const moved = mails.length - errors.length;
      if (moved > 0)
        toast({
          title: moved === 1 ? 'Email movido' : `${moved} emails movidos`,
          description: target.name,
        });
      new Set(mails.map(m => m.accountId)).forEach(accountId =>
        qc.invalidateQueries({ queryKey: ['mail', 'folders', accountId] })
      );
      refreshUnreadSoon(qc);
    },
  };
};
