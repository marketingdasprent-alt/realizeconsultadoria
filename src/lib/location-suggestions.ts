// Locais de ponto sugeridos a partir das tentativas recusadas "fora do raio":
// quando várias picagens falham no mesmo sítio, quase sempre é um local de
// trabalho que ainda não está configurado (ou um raio pequeno demais).

export interface SuggestionAttempt {
  reason: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  employee_id: string | null;
  created_at: string;
  employee?: { name: string; company_id?: string | null } | null;
}

export interface SuggestionLocation {
  id: string;
  name: string;
  company_id: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  is_active: boolean;
}

export interface LocationSuggestion {
  lat: number;
  lng: number;
  attempts: number;
  people: string[];
  /** Empresa da maioria das pessoas que falharam ali. */
  companyId: string | null;
  lastAt: string;
  nearest: { id: string; name: string; distanceM: number; radiusM: number } | null;
  /** 'radius': falha mesmo ao lado de um local (raio curto); 'new': falta um local. */
  kind: 'radius' | 'new';
  /** Raio sugerido quando kind = 'radius'. */
  suggestedRadiusM: number | null;
}

interface SuggestOptions {
  /** Tentativas a menos disto entram no mesmo sítio. */
  clusterRadiusM?: number;
  minAttempts?: number;
  /** Leituras GPS piores do que isto não servem para localizar um sítio. */
  maxAccuracyM?: number;
  /** Até esta distância de um local, a sugestão é aumentar o raio. */
  radiusSuggestionMaxM?: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const distanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

interface Cluster {
  lat: number;
  lng: number;
  items: SuggestionAttempt[];
}

const mostCommon = (values: Array<string | null | undefined>): string | null => {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

/** Agrupa as tentativas recusadas por sítio e diz o que falta configurar. */
export const suggestLocations = (
  attempts: SuggestionAttempt[],
  locations: SuggestionLocation[],
  {
    clusterRadiusM = 150,
    minAttempts = 2,
    maxAccuracyM = 100,
    radiusSuggestionMaxM = 300,
  }: SuggestOptions = {}
): LocationSuggestion[] => {
  const clusters: Cluster[] = [];
  for (const a of attempts) {
    if (a.reason !== 'out_of_radius') continue;
    if (a.latitude === null || a.longitude === null) continue;
    if (a.accuracy_m === null || a.accuracy_m > maxAccuracyM) continue;
    const point = { lat: a.latitude, lng: a.longitude };
    let cluster = clusters.find(c => distanceMeters(c, point) <= clusterRadiusM);
    if (!cluster) {
      cluster = { ...point, items: [] };
      clusters.push(cluster);
    }
    cluster.items.push(a);
    cluster.lat =
      cluster.items.reduce((s, i) => s + (i.latitude as number), 0) / cluster.items.length;
    cluster.lng =
      cluster.items.reduce((s, i) => s + (i.longitude as number), 0) / cluster.items.length;
  }

  const active = locations.filter(l => l.is_active);
  return (
    clusters
      .filter(c => c.items.length >= minAttempts)
      .map(c => {
        const nearestLocation = active
          .map(l => ({ l, d: distanceMeters(c, { lat: l.latitude, lng: l.longitude }) }))
          .sort((x, y) => x.d - y.d)[0];
        const nearest = nearestLocation
          ? {
              id: nearestLocation.l.id,
              name: nearestLocation.l.name,
              distanceM: nearestLocation.d,
              radiusM: nearestLocation.l.radius_m,
            }
          : null;
        const kind: LocationSuggestion['kind'] =
          nearest && nearest.distanceM <= radiusSuggestionMaxM ? 'radius' : 'new';
        return {
          lat: Number(c.lat.toFixed(7)),
          lng: Number(c.lng.toFixed(7)),
          attempts: c.items.length,
          people: [...new Set(c.items.map(i => i.employee?.name).filter((n): n is string => !!n))],
          companyId: mostCommon(c.items.map(i => i.employee?.company_id)),
          lastAt: c.items
            .map(i => i.created_at)
            .sort()
            .at(-1) as string,
          nearest,
          kind,
          // Distância até ao ponto mais afastado do grupo + margem para o GPS dentro de edifícios.
          suggestedRadiusM:
            kind === 'radius' && nearest
              ? Math.ceil((nearest.distanceM + clusterRadiusM / 5 + 25) / 5) * 5
              : null,
        };
      })
      // Já resolvido: o sítio está dentro de um local (criado ou com o raio aumentado).
      .filter(s => !s.nearest || s.nearest.distanceM > s.nearest.radiusM)
      .sort((a, b) => b.people.length - a.people.length || b.attempts - a.attempts)
  );
};
