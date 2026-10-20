// Morada aproximada de um registo fora dos locais (OpenStreetMap). O Nominatim recusa (403)
// os servidores da Supabase; o Photon responde, mas demora segundos — por isso corre em
// segundo plano, depois de o ponto estar registado, e grava a morada no registo.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatPhotonAddress } from '../_shared/timeclock-rules.ts';

const USER_AGENT = 'RealizeConsultadoria-Ponto/1.0 (+https://app.realizeconsultadoria.pt)';

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  const url = `https://photon.komoot.io/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return formatPhotonAddress(data?.features?.[0]?.properties);
  } catch {
    return null;
  }
};

/** Procura a morada e grava-a no registo (se ainda não tiver). Nunca lança erro. */
export const saveEntryAddress = async (
  db: SupabaseClient,
  entryId: string,
  lat: number,
  lng: number
): Promise<void> => {
  const address = await reverseGeocode(lat, lng);
  if (!address) return;
  const { error } = await db
    .from('time_clock_entries')
    .update({ address })
    .eq('id', entryId)
    .is('address', null);
  if (error) console.error('clock-punch address:', error.message);
};
