// Apreciações: as de uma pessoa (perfil), as públicas recentes (Feed) e enviar.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_APPRECIATIONS } from '../lib/demoData';
import { appreciationErrorText, messageShortfall } from '../lib/appreciationRules';
import { FEED_KEYS } from '../lib/feed';
import { appreciationService, type AppreciationRow } from '../services/appreciationService';
import type { Appreciation, AppreciationKind, NewAppreciationInput } from '../types';
import { useDirectory } from './useDirectory';

// Exemplo partilhado entre ecrãs da pré-visualização (só em memória).
let demoStore: Appreciation[] = DEMO_APPRECIATIONS;

/**
 * `scope`: um utilizador (recebidas + enviadas) ou 'public' (reconhecimentos públicos
 * recentes da empresa).
 */
export const useAppreciations = (scope: { userId: string } | 'public') => {
  const { isPreview, user } = useWorkspace();
  const { nameOf } = useDirectory();
  const qc = useQueryClient();
  const [demo, setDemo] = useState<Appreciation[]>(demoStore);
  const key = scope === 'public' ? 'public' : scope.userId;

  const live = useQuery({
    queryKey: [...FEED_KEYS.appreciations, key],
    queryFn: async () => {
      const { data, error } =
        scope === 'public'
          ? await appreciationService.listRecentPublic()
          : await appreciationService.listForUser(scope.userId);
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
  });

  const toAppreciation = (row: AppreciationRow): Appreciation => ({
    id: row.id,
    kind: row.kind as AppreciationKind,
    senderId: row.sender_id,
    senderName: nameOf(row.sender_id),
    recipientId: row.recipient_id,
    recipientName: nameOf(row.recipient_id),
    message: row.message,
    isPublic: row.is_public,
    createdAt: row.created_at,
  });

  const items: Appreciation[] = useMemo(() => {
    if (!isPreview) return (live.data ?? []).map(toAppreciation);
    return scope === 'public'
      ? demo.filter(a => a.isPublic)
      : demo.filter(a => a.recipientId === key || a.senderId === key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toAppreciation depende só de nameOf
  }, [isPreview, live.data, demo, key, scope, nameOf]);

  const send = async (input: NewAppreciationInput): Promise<boolean> => {
    if (messageShortfall(input.message) > 0) {
      toast({
        title: 'Diga que trabalho está a reconhecer',
        description: 'O motivo é obrigatório.',
        variant: 'destructive',
      });
      return false;
    }
    if (isPreview) {
      demoStore = [
        {
          id: `demo-${Date.now()}`,
          kind: input.kind,
          senderId: user.userId,
          senderName: user.name,
          recipientId: input.recipientId,
          recipientName: nameOf(input.recipientId),
          message: input.message.trim() || null,
          isPublic: input.isPublic,
          createdAt: new Date().toISOString(),
        },
        ...demoStore,
      ];
      setDemo(demoStore);
      return true;
    }
    const { error } = await appreciationService.send(user.companyId, user.userId, input);
    if (error) {
      toast({ title: appreciationErrorText(error), variant: 'destructive' });
      return false;
    }
    void qc.invalidateQueries({ queryKey: FEED_KEYS.appreciations });
    return true;
  };

  return {
    items,
    received: scope === 'public' ? [] : items.filter(a => a.recipientId === key),
    sent: scope === 'public' ? [] : items.filter(a => a.senderId === key),
    isLoading: !isPreview && live.isLoading,
    send,
  };
};
