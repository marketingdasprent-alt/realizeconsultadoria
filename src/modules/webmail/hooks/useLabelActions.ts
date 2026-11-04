import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mailErrorText, mailService } from '../services/mailService';
import { labelCountsKey } from './useLabelCounts';
import type { MailFolder, MailLabel, MailSummary } from '../types';
import { patchLists } from './useMailChanges';
import { bumpUnread, refreshUnreadSoon } from './useUnreadCounts';

/**
 * Pôr/tirar marcadores em emails (todos da mesma caixa). O marcador aparece logo; se o marcador
 * tem automação (mover, marcar como lido, tirar outros) o servidor faz e a lista acompanha.
 */
export const useLabelActions = (folder?: MailFolder) => {
  const qc = useQueryClient();
  const { user } = useWorkspace();

  /** Põe o marcador em todos, ou tira-o se todos já o têm. */
  const toggle = async (mails: MailSummary[], label: MailLabel) => {
    if (!mails.length) return;
    const on = !mails.every(mail => mail.labelIds?.includes(label.id));
    const auto = label.onApply;
    const targets = on ? mails : mails.filter(mail => mail.labelIds?.includes(label.id));
    targets.forEach(mail => {
      const current = mail.labelIds ?? [];
      const next = on
        ? [...new Set([...current, label.id])].filter(id => !auto.removeLabelIds.includes(id))
        : current.filter(id => id !== label.id);
      patchLists(qc, user.userId, mail, {
        labelIds: next,
        ...(on && auto.markRead ? { unread: false } : {}),
      });
    });
    const { data, error } = await mailService.applyLabel(label.accountId, label.id, targets, on);
    void qc.invalidateQueries({ queryKey: labelCountsKey(label.accountId) });
    if (error || !data) {
      void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
      toast({
        title: 'Não foi possível pôr o marcador',
        description: mailErrorText(error),
        variant: 'destructive',
      });
      return;
    }
    // Os que a automação moveu para uma pasta saem desta lista
    const moved = new Set(data.moved);
    targets
      .filter(mail => moved.has(mail.id))
      .forEach(mail => {
        patchLists(qc, user.userId, mail, 'remove');
        if ((folder === 'inbox' || folder === 'unread') && mail.unread && !auto.markRead)
          bumpUnread(qc, mail.accountId, -1);
      });
    if (on && (auto.folderId || auto.markRead)) refreshUnreadSoon(qc);
    if (data.error)
      toast({
        title: 'O marcador foi posto, mas a automação falhou',
        description: 'Não foi possível mover para a pasta do marcador.',
        variant: 'destructive',
      });
  };

  return { toggle };
};
