import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import {
  suggestLocations,
  type LocationSuggestion,
  type SuggestionLocation,
} from '@/lib/location-suggestions';
import { timeClockService, type TimeClockAttemptWithRelations } from '../services/timeClockService';

/** Janela de tentativas recusadas usada para sugerir locais. */
const SUGGESTION_WINDOW_DAYS = 30;

interface UseLocationSuggestionsResult {
  suggestions: LocationSuggestion[];
  refetch: () => Promise<void>;
}

/**
 * Sítios onde várias picagens falharam "fora do raio": locais por configurar
 * ou raios demasiado pequenos.
 */
export const useLocationSuggestions = (
  locations: SuggestionLocation[],
  enabled: boolean
): UseLocationSuggestionsResult => {
  const [attempts, setAttempts] = useState<TimeClockAttemptWithRelations[]>([]);

  const fetchAttempts = useCallback(async () => {
    if (!enabled) return;
    const now = new Date();
    const { data } = await timeClockService.getAttempts(
      addDays(now, -SUGGESTION_WINDOW_DAYS).toISOString(),
      addDays(now, 1).toISOString()
    );
    setAttempts(data);
  }, [enabled]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  const suggestions = useMemo(() => suggestLocations(attempts, locations), [attempts, locations]);

  return { suggestions, refetch: fetchAttempts };
};
