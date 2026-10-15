import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CHAT_KEYS } from '@/modules/messenger/lib/cache';
import { DEMO_DIRECTORY } from '@/modules/messenger/lib/demoData';
import { FORMER_COLLEAGUE, toPerson } from '@/modules/messenger/lib/mappers';
import { messengerService } from '@/modules/messenger/services/messengerService';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';

/**
 * Colegas ativos da mesma empresa (só dados profissionais). Partilha a cache com o
 * Messenger; na pré-visualização devolve pessoas de exemplo.
 */
export const useDirectory = () => {
  const { isPreview, user } = useWorkspace();
  const query = useQuery({
    queryKey: CHAT_KEYS.directory,
    queryFn: async () => {
      const { data, error } = await messengerService.getDirectory();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
    staleTime: 5 * 60_000,
  });

  const people: DirectoryPerson[] = useMemo(
    () => (isPreview ? DEMO_DIRECTORY : (query.data ?? []).map(toPerson)),
    [isPreview, query.data]
  );
  const byId = useMemo(() => new Map(people.map(person => [person.userId, person])), [people]);

  const nameOf = useCallback(
    (userId: string | null) =>
      userId === user.userId ? user.name : ((userId && byId.get(userId)?.name) ?? FORMER_COLLEAGUE),
    [byId, user.userId, user.name]
  );

  return {
    /** Sem o próprio utilizador. */
    colleagues: people.filter(person => person.userId !== user.userId),
    byId,
    nameOf,
    isLoading: !isPreview && query.isLoading,
  };
};
