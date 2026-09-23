import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getBestPosition } from '@/lib/geolocation';
import { extractMapsCoordinates, isGoogleSearchLink, isShortMapsLink } from '@/lib/maps-link';
import { getErrorMessage } from '@/lib/timeclock';
import { timeClockLocationService } from '../services/timeClockLocationService';

export const COORDINATES_HOW_TO =
  'No Google Maps, clique com o botão direito no ponto exato e clique nas coordenadas para as copiar.';
const VIEWPORT_WARNING =
  'Este link indica só o centro do mapa, não um ponto marcado. Confirme o pino no mapa abaixo.';

type ApplyCoordinates = (coords: { lat: number; lng: number }, hint: string | null) => void;

interface UseCoordinateResolverResult {
  busy: 'link' | 'gps' | null;
  /** Texto colado: link do Google Maps (direto ou curto) ou "lat, lng". */
  resolveInput: (raw: string) => Promise<void>;
  /** Posição GPS atual do dispositivo (admin no local). */
  resolveCurrentPosition: () => Promise<void>;
}

/**
 * Obtém coordenadas de um local a partir de um link do Google Maps, texto ou GPS.
 */
export const useCoordinateResolver = (apply: ApplyCoordinates): UseCoordinateResolverResult => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'link' | 'gps' | null>(null);

  const resolveInput = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      const local = extractMapsCoordinates(value);
      if (local) {
        apply(local, local.precision === 'viewport' ? VIEWPORT_WARNING : null);
        return;
      }
      if (isGoogleSearchLink(value)) {
        toast({
          title: 'Isto é um link de pesquisa do Google',
          description:
            'Não traz coordenadas. Abra o local no Google Maps → Partilhar → Copiar link, ou copie as coordenadas.',
          variant: 'destructive',
        });
        return;
      }
      if (!isShortMapsLink(value)) {
        toast({
          title: 'Não encontrei coordenadas',
          description: COORDINATES_HOW_TO,
          variant: 'destructive',
        });
        return;
      }
      setBusy('link');
      const { data, error } = await timeClockLocationService.resolveMapsLink(value);
      setBusy(null);
      const coords = data?.coordinates;
      if (error || !coords) {
        const reason = error?.message ? `${error.message}. ` : '';
        toast({
          title: 'Não foi possível ler o link',
          description: reason + COORDINATES_HOW_TO,
          variant: 'destructive',
        });
        return;
      }
      apply(coords, coords.precision === 'viewport' ? VIEWPORT_WARNING : null);
    },
    [apply, toast]
  );

  const resolveCurrentPosition = useCallback(async () => {
    setBusy('gps');
    try {
      const pos = await getBestPosition({ maxWaitMs: 10000, targetAccuracyM: 15 });
      apply(pos, `Localização atual do dispositivo (precisão ±${Math.round(pos.accuracy)} m).`);
    } catch (error: unknown) {
      const description = getErrorMessage(error, 'Sem localização');
      toast({ title: 'Erro', description, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [apply, toast]);

  return { busy, resolveInput, resolveCurrentPosition };
};
