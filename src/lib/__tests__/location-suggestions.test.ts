import { describe, expect, it } from 'vitest';
import {
  distanceMeters,
  suggestLocations,
  type SuggestionAttempt,
  type SuggestionLocation,
} from '../location-suggestions';

const OFFICE: SuggestionLocation = {
  id: 'loc-1',
  name: 'Rua Das Oliveiras',
  company_id: 'realize',
  latitude: 39.7628392,
  longitude: -8.7990065,
  radius_m: 50,
  is_active: true,
};

let seq = 0;
const attempt = (
  name: string,
  lat: number,
  lng: number,
  extra: Partial<SuggestionAttempt> = {}
): SuggestionAttempt => ({
  reason: 'out_of_radius',
  latitude: lat,
  longitude: lng,
  accuracy_m: 15,
  employee_id: name,
  created_at: `2026-10-12T09:0${seq++ % 10}:00Z`,
  employee: { name, company_id: 'realize' },
  ...extra,
});

describe('suggestLocations', () => {
  it('finds a workplace that is not configured, from several people failing at the same spot', () => {
    // Caso real: 3 pessoas a 1,6 km do escritório, todas no mesmo ponto.
    const suggestions = suggestLocations(
      [
        attempt('Juliano', 39.74904, -8.79374),
        attempt('Lucas', 39.74906, -8.79371),
        attempt('Inês', 39.74901, -8.79378),
        attempt('Juliano', 39.74905, -8.79375),
      ],
      [OFFICE]
    );
    expect(suggestions).toHaveLength(1);
    const [s] = suggestions;
    expect(s.kind).toBe('new');
    expect(s.attempts).toBe(4);
    expect(s.people).toEqual(['Juliano', 'Lucas', 'Inês']);
    expect(s.companyId).toBe('realize');
    expect(s.nearest?.name).toBe('Rua Das Oliveiras');
    expect(s.nearest!.distanceM).toBeGreaterThan(1500);
    expect(distanceMeters(s, { lat: 39.74904, lng: -8.79374 })).toBeLessThan(5);
  });

  it('suggests a bigger radius when people fail right next to an existing location', () => {
    // Caso real: no fundo do escritório, a 54 m de um raio de 50 m.
    const [s] = suggestLocations(
      [attempt('Thiago', 39.76287, -8.79964), attempt('Thiago', 39.76287, -8.79964)],
      [OFFICE]
    );
    expect(s.kind).toBe('radius');
    expect(s.suggestedRadiusM).toBeGreaterThanOrEqual(85);
    expect(s.suggestedRadiusM! % 5).toBe(0);
  });

  it('ignores single attempts, imprecise GPS and other rejection reasons', () => {
    expect(
      suggestLocations(
        [
          attempt('Marcia', 39.75716, -8.80441),
          attempt('Elena', 39.79013, -8.82246, { accuracy_m: 1986 }),
          attempt('Elena', 39.79013, -8.82246, { accuracy_m: 1414 }),
          attempt('Luiz', 39.7629, -8.799, { reason: 'stale_position' }),
          attempt('Luiz', 39.7629, -8.799, { reason: 'stale_position' }),
        ],
        [OFFICE]
      )
    ).toEqual([]);
  });

  it('stops suggesting once the place is covered by a location', () => {
    const fails = [attempt('Lucas', 39.74904, -8.79374), attempt('Inês', 39.74905, -8.79373)];
    const newSite = {
      ...OFFICE,
      id: 'loc-2',
      name: 'Novo',
      latitude: 39.74904,
      longitude: -8.79374,
    };
    expect(suggestLocations(fails, [OFFICE, newSite])).toEqual([]);
    const bigger = { ...OFFICE, radius_m: 90 };
    expect(
      suggestLocations(
        [attempt('Thiago', 39.76287, -8.79964), attempt('Thiago', 39.76287, -8.79964)],
        [bigger]
      )
    ).toEqual([]);
  });

  it('puts the places with more people first', () => {
    const suggestions = suggestLocations(
      [
        attempt('Bruno', 38.70498, -9.23947),
        attempt('Bruno', 38.70499, -9.23946),
        attempt('Elena', 39.79013, -8.82246),
        attempt('Franciele', 39.79014, -8.82245),
        attempt('Ivone', 39.79012, -8.82247),
      ],
      [OFFICE]
    );
    expect(suggestions.map(s => s.people.length)).toEqual([3, 1]);
  });
});
