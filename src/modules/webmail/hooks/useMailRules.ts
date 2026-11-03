import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { mailErrorText, mailService } from '../services/mailService';
import type { MailRule } from '../types';

const key = (accountId: string | null) => ['mail', 'rules', accountId] as const;

type NewRule = Pick<MailRule, 'name' | 'fromContains' | 'keyword' | 'folderId' | 'folderName'> &
  Partial<Pick<MailRule, 'id' | 'markRead' | 'isActive' | 'labelIds'>>;

/** Regras de uma caixa: lista, criar (e aplicar aos emails que já lá estão), ligar/desligar, apagar. */
export const useMailRules = (accountId: string | null) => {
  const qc = useQueryClient();
  const rules = useQuery({
    queryKey: key(accountId),
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await mailService.rules(accountId ?? '');
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key(accountId) });
  const refreshMail = () => {
    void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
    void qc.invalidateQueries({ queryKey: ['mail', 'folders', accountId] });
  };

  const save = useMutation({
    mutationFn: async (input: { rule: NewRule; applyNow: boolean }) => {
      const saved = await mailService.saveRule(accountId ?? '', input.rule);
      if (saved.error || !saved.data)
        throw new Error(mailErrorText(saved.error) || 'Não guardada.');
      let moved = 0;
      if (input.applyNow) {
        const run = await mailService.runRule(accountId ?? '', saved.data.id);
        moved = run.data?.moved ?? 0;
      }
      return moved;
    },
    onSuccess: (moved, input) => {
      toast({
        title: 'Regra guardada',
        description: input.applyNow
          ? moved === 1
            ? '1 email que já estava na Entrada foi movido.'
            : `${moved} emails que já estavam na Entrada foram movidos.`
          : 'Aplica-se aos emails que chegarem daqui para a frente.',
      });
      void refresh();
      refreshMail();
    },
    onError: (error: Error) =>
      toast({
        title: 'Não foi possível guardar a regra',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const toggle = useMutation({
    mutationFn: async (rule: MailRule) => {
      const { error } = await mailService.saveRule(rule.accountId, {
        ...rule,
        isActive: !rule.isActive,
      });
      if (error) throw new Error(mailErrorText(error));
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) =>
      toast({ title: 'Não foi possível', description: error.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (rule: MailRule) => {
      const { error } = await mailService.deleteRule(rule.accountId, rule.id);
      if (error) throw new Error(mailErrorText(error));
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) =>
      toast({
        title: 'Não foi possível apagar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return { rules, save, toggle, remove };
};
