import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { applyAccountOrder } from '../lib/accountOrder';
import { setDemoMail, useDemoMail } from '../lib/demoStore';
import type { MailProviderKey } from '../lib/providers';
import { mailErrorText, mailService, type MailError } from '../services/mailService';
import type { ImapConnectInput, MailAccount } from '../types';

export const MAIL_ACCOUNTS_KEY = ['mail', 'accounts'] as const;

const fail = (error: MailError | null, fallback: string): void => {
  toast({
    title: 'Não foi possível',
    description: mailErrorText(error) || fallback,
    variant: 'destructive',
  });
};

/** Caixas de correio do colaborador e as ações sobre elas (ligar, editar, desligar). */
export const useMailAccounts = () => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const demo = useDemoMail();
  const query = useQuery({
    queryKey: MAIL_ACCOUNTS_KEY,
    queryFn: async () => {
      const { data, error } = await mailService.listAccounts();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['mail'] });

  return {
    accounts: isPreview ? demo.accounts : (query.data ?? []),
    isLoading: !isPreview && query.isLoading,
    refresh,

    update: async (
      id: string,
      patch: Partial<Pick<MailAccount, 'displayName' | 'signature' | 'isDefault' | 'color'>>
    ) => {
      if (isPreview) {
        setDemoMail(s => ({
          ...s,
          accounts: s.accounts.map(a =>
            a.id === id ? { ...a, ...patch } : patch.isDefault ? { ...a, isDefault: false } : a
          ),
        }));
        return true;
      }
      const shared = !!qc.getQueryData<MailAccount[]>(MAIL_ACCOUNTS_KEY)?.find(a => a.id === id)
        ?.shared;
      // Na hora no ecrã; grava em fundo e só volta atrás se falhar.
      qc.setQueryData<MailAccount[]>(MAIL_ACCOUNTS_KEY, list =>
        list?.map(a =>
          a.id === id ? { ...a, ...patch } : patch.isDefault ? { ...a, isDefault: false } : a
        )
      );
      const { error } = await mailService.updateAccount(id, patch, shared);
      if (error) {
        fail(null, 'As alterações não foram guardadas.');
        void qc.invalidateQueries({ queryKey: MAIL_ACCOUNTS_KEY });
        return false;
      }
      return true;
    },

    /** Nova ordem das caixas (arrastar ou alfabética): já no ecrã; grava em fundo. */
    reorder: async (ids: string[]) => {
      const sort = (list: MailAccount[]) =>
        applyAccountOrder(list, new Map(ids.map((id, index) => [id, index])));
      if (isPreview) {
        setDemoMail(s => ({ ...s, accounts: sort(s.accounts) }));
        return;
      }
      qc.setQueryData<MailAccount[]>(MAIL_ACCOUNTS_KEY, list => list && sort(list));
      const { error } = await mailService.saveAccountOrder(ids);
      if (error) {
        fail(null, 'A ordem das caixas não foi guardada.');
        void qc.invalidateQueries({ queryKey: MAIL_ACCOUNTS_KEY });
      }
    },

    disconnect: async (id: string) => {
      if (isPreview) {
        setDemoMail(s => ({ ...s, accounts: s.accounts.filter(a => a.id !== id) }));
        return;
      }
      const { error } = await mailService.disconnect(id);
      if (error) return fail(error, 'A caixa não foi desligada.');
      toast({ title: 'Caixa de correio desligada' });
      await refresh();
    },

    /** Abre a autorização do Google/Microsoft; volta a /email?mail=ligada. */
    startOAuth: async (provider: MailProviderKey) => {
      if (isPreview) {
        toast({ title: 'Pré-visualização', description: 'Aqui não se ligam contas reais.' });
        return;
      }
      const back = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await mailService.startOAuth(provider, back);
      if (error || !data) return fail(error, 'Não foi possível iniciar a ligação.');
      window.location.assign(data.url);
    },

    connectImap: async (input: ImapConnectInput) => {
      if (isPreview) {
        toast({ title: 'Pré-visualização', description: 'Aqui não se ligam contas reais.' });
        return false;
      }
      const { error } = await mailService.connectImap(input);
      if (error) {
        fail(error, 'A caixa não foi ligada.');
        return false;
      }
      toast({ title: 'Caixa de correio ligada' });
      await refresh();
      return true;
    },
  };
};
