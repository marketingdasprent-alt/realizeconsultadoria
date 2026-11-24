import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCompanyScope } from '@/modules/admin/context/CompanyScopeContext';
import { filterByScope } from '@/modules/admin/lib/companyScope';
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
  const [allLocations, setLocations] = useState<TimeClockLocationWithTags[]>([]);
  // Só os locais das empresas escolhidas no menu (sem escolha: todos os que a conta vê).
  const { ids: scopeIds } = useCompanyScope();
  const locations = useMemo(
    () => filterByScope(allLocations, scopeIds, l => l.company_id),
    [allLocations, scopeIds]
  );
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
