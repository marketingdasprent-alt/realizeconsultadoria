import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildBoard, type BoardPerson } from '../lib/todayBoard';
import { todayBoardService } from '../services/todayBoardService';
import { useNow } from './useNow';

/**
 * Quadro "Hoje": quem está a trabalhar, em pausa, já saiu, ainda não começou ou está
 * ausente — atualiza a cada minuto (e os tempos a correr, a cada 30 s).
 */
export const useTodayBoard = (enabled = true) => {
  const query = useQuery({
    queryKey: ['timeclock', 'today-board'],
    queryFn: async () => {
      const { data, error } = await todayBoardService.getBoard();
      if (error || !data) throw error ?? new Error('Sem dados');
      return data;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const now = useNow(30_000);

  const people: BoardPerson[] = useMemo(
    () => (query.data ? buildBoard({ ...query.data, now }) : []),
    [query.data, now]
  );

  return {
    people,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    updatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
};
