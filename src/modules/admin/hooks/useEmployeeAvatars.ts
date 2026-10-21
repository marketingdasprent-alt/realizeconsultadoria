import { useQuery } from '@tanstack/react-query';
import { avatarUrl } from '@/modules/workspace/lib/avatars';
import { profileService } from '../services/profileService';

/** Fotografia de cada colaborador (por user_id), num só pedido e em cache. */
export const useEmployeeAvatars = () => {
  const { data } = useQuery({
    queryKey: ['admin', 'avatars'],
    queryFn: async () => {
      const { data: rows, error } = await profileService.getAvatarPaths();
      if (error) throw error;
      return new Map((rows ?? []).map(row => [row.user_id, avatarUrl(row.avatar_path)]));
    },
    staleTime: 5 * 60_000,
  });
  return (userId: string | null | undefined): string | null =>
    (userId && data?.get(userId)) || null;
};
