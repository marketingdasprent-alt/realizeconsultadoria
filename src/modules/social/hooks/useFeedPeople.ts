// Nomes de quem escreveu, comentou ou reagiu numa publicação de outra empresa do grupo. Essas
// pessoas não estão no meu diretório: a base devolve só o nome e a empresa (feed_post_people).
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FORMER_COLLEAGUE } from '@/modules/messenger/lib/mappers';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { FEED_KEYS, personLabel } from '../lib/feed';
import { feedService } from '../services/feedService';
import { useDirectory } from './useDirectory';

/**
 * `labelOf(userId)`: o nome do diretório se a pessoa lá estiver; senão "Nome - Empresa"; senão
 * (base antiga, sem a função) "Colaborador · Empresa". Sem `companyName` (publicação da minha
 * empresa) não vai buscar nada e fica como estava.
 */
export const useFeedPeople = (
  postId: string,
  companyName?: string | null,
  enabled: boolean = true
) => {
  const { isPreview } = useWorkspace();
  const { nameOf } = useDirectory();
  const { data } = useQuery({
    queryKey: FEED_KEYS.people(postId),
    queryFn: async () => {
      const { data: rows, error } = await feedService.listPeople(postId);
      // Função inexistente (base antiga) ou sem acesso: segue com o rótulo genérico.
      return error ? [] : rows;
    },
    enabled: enabled && !!companyName && !isPreview,
  });

  const byUser = useMemo(
    () => new Map((data ?? []).map(person => [person.user_id, person])),
    [data]
  );

  const labelOf = useCallback(
    (userId: string | null): string => {
      const name = nameOf(userId);
      if (!companyName || name !== FORMER_COLLEAGUE) return name;
      const person = userId ? byUser.get(userId) : undefined;
      return person
        ? personLabel(person.name, person.company_name ?? companyName)
        : `Colaborador · ${companyName}`;
    },
    [nameOf, companyName, byUser]
  );

  return { labelOf };
};
