// Avisos dos RH (tabela notifications) no Feed, com confirmação de leitura.
// Mesma segmentação de sempre: globais, da empresa e individuais.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeHomeService } from '@/modules/employee/services/employeeHomeService';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_NOTICES } from '../lib/demoData';
import { FEED_KEYS } from '../lib/feed';
import type { Notice } from '../types';

export const useNotices = () => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const [demo, setDemo] = useState<Notice[]>(DEMO_NOTICES);

  const live = useQuery({
    queryKey: FEED_KEYS.notices,
    queryFn: async () => {
      const { data, error } = await employeeHomeService.getNotices(user.companyId, user.employeeId);
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
  });

  const notices: Notice[] = useMemo(
    () =>
      isPreview
        ? demo
        : (live.data ?? []).map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            createdAt: n.created_at,
            read: n.read,
          })),
    [isPreview, demo, live.data]
  );

  const confirmRead = async (ids: string[]) => {
    if (isPreview) {
      return setDemo(list => list.map(n => (ids.includes(n.id) ? { ...n, read: true } : n)));
    }
    // Confirmado na hora; o servidor grava em fundo.
    qc.setQueryData<typeof live.data>(FEED_KEYS.notices, list =>
      list?.map(n => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
    await employeeHomeService.markNoticesRead(user.employeeId, ids);
    void qc.invalidateQueries({ queryKey: FEED_KEYS.notices });
  };

  return {
    notices,
    unread: notices.filter(n => !n.read).length,
    isLoading: !isPreview && live.isLoading,
    confirmRead,
  };
};
