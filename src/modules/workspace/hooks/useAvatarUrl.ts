import { useQuery } from '@tanstack/react-query';
import { CHAT_KEYS } from '@/modules/messenger/lib/cache';
import { messengerService } from '@/modules/messenger/services/messengerService';
import { useWorkspace } from '../context/workspaceContext';
import { avatarUrl } from '../lib/avatars';

const fetchDirectory = async () => {
  const { data, error } = await messengerService.getDirectory();
  if (error) throw error;
  return data;
};

/**
 * URL da fotografia de uma pessoa, a partir do diretório da empresa (a mesma cache do
 * Messenger e dos Colaboradores: um só pedido para todos os avatares). null sem foto.
 */
export const useAvatarUrl = (userId: string | null | undefined): string | null => {
  const { isPreview } = useWorkspace();
  const { data } = useQuery({
    queryKey: CHAT_KEYS.directory,
    queryFn: fetchDirectory,
    enabled: !isPreview && !!userId,
    staleTime: 5 * 60_000,
    select: rows => rows.find(row => row.user_id === userId)?.avatar_path ?? null,
  });
  return avatarUrl(data);
};
