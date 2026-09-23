import { useCallback, useEffect, useState } from 'react';
import {
  timeClockLocationService,
  type TimeClockLocationWithTags,
} from '../services/timeClockLocationService';

interface UseTimeClockLocationsResult {
  locations: TimeClockLocationWithTags[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Locais de ponto com as respetivas tags NFC.
 */
export const useTimeClockLocations = (): UseTimeClockLocationsResult => {
  const [locations, setLocations] = useState<TimeClockLocationWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await timeClockLocationService.getAll();
    if (fetchError) setError('Erro ao carregar os locais de ponto');
    else setLocations(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return { locations, isLoading, error, refetch: fetchLocations };
};
