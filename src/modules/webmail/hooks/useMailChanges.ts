import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mapPerGroup } from '../lib/concurrency';
import { patchDemoMail, type DemoMail } from '../lib/demoStore';
import { mailService, type MailError } from '../services/mailService';
import type { MailFolder, MailSummary } from '../types';
import { bumpUnread, refreshUnreadSoon } from './useUnreadCounts';

export type MailChange = 'read' | 'unread' | 'star' | 'unstar' | 'trash';

/** Pedidos em simultâneo por caixa (o Microsoft Graph recusa mais de 4 na mesma caixa). */
const PER_ACCOUNT = 3;

type ListData = InfiniteData<{ messages: MailSummary[] }>;

/** Atualiza já as listas em cache (antes da resposta do fornecedor). */
const patchLists = (
  qc: QueryClient,
  target: MailSummary,
  patch: Partial<MailSummary> | 'remove'
) => {
  const same = (m: MailSummary) => m.id === target.id && m.accountId === target.accountId;
  qc.setQueriesData<ListData>({ queryKey: ['mail', 'list'] }, data =>
    data
      ? {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            messages:
              patch === 'remove'
                ? page.messages.filter(m => !same(m))
                : page.messages.map(m => (same(m) ? { ...m, ...patch } : m)),
          })),
        }
      : data
  );
};

interface ChangeSpec {
  /** Só os emails que mudam mesmo (marcar como lido um já lido não faz pedido). */
  applies: (mail: MailSummary) => boolean;
  patch: Partial<MailSummary> | 'remove';
  demo: Partial<DemoMail>;
  /** Variação dos "por ler" da caixa. */
  unread: (mail: MailSummary) => number;
  remote: (mail: MailSummary) => Promise<{ error: MailError | null }>;
}

const CHANGES: Record<MailChange, ChangeSpec> = {
  read: {
    applies: m => m.unread,
    patch: { unread: false },
    demo: { unread: false },
    unread: () => -1,
    remote: m => mailService.setRead(m.accountId, m.id, true),
  },
  unread: {
    applies: m => !m.unread,
    patch: { unread: true },
    demo: { unread: true },
    unread: () => 1,
    remote: m => mailService.setRead(m.accountId, m.id, false),
  },
  star: {
    applies: m => !m.starred,
    patch: { starred: true },
    demo: { starred: true },
    unread: () => 0,
    remote: m => mailService.setStarred(m.accountId, m.id, true),
  },
  unstar: {
    applies: m => m.starred,
    patch: { starred: false },
    demo: { starred: false },
    unread: () => 0,
    remote: m => mailService.setStarred(m.accountId, m.id, false),
  },
  trash: {
    applies: () => true,
    patch: 'remove',
    demo: { folder: 'trash' },
    unread: m => (m.unread ? -1 : 0),
    remote: m => mailService.trash(m.accountId, m.id),
  },
};

const UNAVAILABLE: MailError = { code: 'unavailable', message: '' };

/**
 * Aplica uma alteração a um ou vários emails: no ecrã de imediato e depois no fornecedor, até
 * 3 pedidos de cada vez por caixa. O que falhar volta atrás. Devolve os erros.
 * `folder`: a pasta à vista; os "por ler" contam a Entrada, por isso só aí se acertam já.
 */
export const useMailChanges = (folder?: MailFolder) => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const bump = (mail: MailSummary, delta: number) => {
    if (folder === 'inbox') bumpUnread(qc, mail.accountId, delta);
  };

  return async (mails: MailSummary[], kind: MailChange): Promise<MailError[]> => {
    const change = CHANGES[kind];
    const targets = mails.filter(change.applies);
    if (!targets.length) return [];
    if (isPreview) {
      targets.forEach(mail => patchDemoMail(mail.id, change.demo));
      return [];
    }

    targets.forEach(mail => {
      patchLists(qc, mail, change.patch);
      bump(mail, change.unread(mail));
    });
    const results = await mapPerGroup(
      targets,
      mail => mail.accountId,
      PER_ACCOUNT,
      mail => change.remote(mail).catch(() => ({ error: UNAVAILABLE }))
    );

    const errors: MailError[] = [];
    results.forEach(({ error }, index) => {
      if (!error) return;
      errors.push(error);
      const mail = targets[index];
      bump(mail, -change.unread(mail));
      if (change.patch !== 'remove')
        patchLists(qc, mail, { unread: mail.unread, starred: mail.starred });
    });
    // Os que não foram para o lixo voltam a aparecer com a lista atualizada.
    if (errors.length && change.patch === 'remove')
      void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
    if (kind !== 'star' && kind !== 'unstar') refreshUnreadSoon(qc);
    return errors;
  };
};
