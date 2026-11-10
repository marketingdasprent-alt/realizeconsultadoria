// Próximos aniversários dos colegas da empresa (só dia e mês; a idade nunca é mostrada).
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { feedService } from '../services/feedService';

export interface UpcomingBirthday {
  userId: string;
  name: string;
  /** Dia do aniversário este ano (AAAA-MM-DD). */
  date: string;
  daysUntil: number;
}

/** Aniversários de hoje até daqui a `days` dias. */
export const useUpcomingBirthdays = (days = 14) => {
  const { isPreview } = useWorkspace();
  const { data } = useQuery({
    queryKey: ['feed', 'birthdays', days],
    queryFn: async (): Promise<UpcomingBirthday[]> => {
      const { data: rows, error } = await feedService.upcomingBirthdays(days);
      if (error) throw error;
      return rows.map(row => ({
        userId: row.user_id,
        name: row.name,
        date: row.birthday,
        daysUntil: row.days_until,
      }));
    },
    enabled: !isPreview,
    staleTime: 60 * 60 * 1000,
  });
  return data ?? [];
};
