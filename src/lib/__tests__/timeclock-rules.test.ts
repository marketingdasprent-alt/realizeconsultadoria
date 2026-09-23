// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  evaluatePunch,
  haversineMeters,
  ipMatchesAny,
  nextEntryType,
  sha256Hex,
  type PunchContext,
} from '../../../supabase/functions/_shared/timeclock-rules';

// Escritório de referência (Lisboa) e um ponto ~30 m a norte.
const OFFICE = { lat: 38.7223, lng: -9.1393 };
const NEAR = { lat: 38.72257, lng: -9.1393 };

const baseContext = (overrides: Partial<PunchContext> = {}): PunchContext => ({
  method: 'gps',
  position: { ...NEAR, accuracy: 15, ageMs: 1000 },
  location: { ...OFFICE, radiusM: 50, maxAccuracyM: 100, blockVpn: false, trustedIps: [] },
  ip: '85.240.10.20',
  ipInfo: { checked: true, country: 'PT', lat: 38.72, lng: -9.14, isProxy: false },
  previous: null,
  nowMs: Date.UTC(2026, 8, 23, 9, 0),
  repeatedCoordinates: false,
  deviceSeenBefore: true,
  deviceUsedByOthers: false,
  ...overrides,
});

describe('haversineMeters', () => {
  it('measures short distances accurately', () => {
    expect(haversineMeters(OFFICE, NEAR)).toBeGreaterThan(25);
    expect(haversineMeters(OFFICE, NEAR)).toBeLessThan(35);
  });

  it('measures Lisbon → Porto (~274 km)', () => {
    const km = haversineMeters(OFFICE, { lat: 41.1579, lng: -8.6291 }) / 1000;
    expect(km).toBeGreaterThan(265);
    expect(km).toBeLessThan(285);
  });
});

describe('ipMatchesAny', () => {
  it('matches exact IPs and IPv4 CIDR ranges', () => {
    expect(ipMatchesAny('85.240.10.20', ['85.240.10.20'])).toBe(true);
    expect(ipMatchesAny('85.240.10.99', ['85.240.10.0/24'])).toBe(true);
    expect(ipMatchesAny('85.240.11.1', ['85.240.10.0/24'])).toBe(false);
    expect(ipMatchesAny('2001:db8::1', ['2001:db8::1'])).toBe(true);
    expect(ipMatchesAny(null, ['85.240.10.20'])).toBe(false);
    expect(ipMatchesAny('85.240.10.20', ['garbage/99'])).toBe(false);
  });
});

describe('evaluatePunch', () => {
  it('accepts a clean punch inside the radius', () => {
    const result = evaluatePunch(baseContext());
    expect(result.rejected).toBeNull();
    expect(result.status).toBe('valid');
    expect(result.flags).toContain('gps_only');
  });

  it('rejects outside the radius (GPS only is strict)', () => {
    const far = { lat: 38.7233, lng: -9.1393 }; // ~110 m
    expect(
      evaluatePunch(baseContext({ position: { ...far, accuracy: 10, ageMs: 0 } })).rejected
    ).toBe('out_of_radius');
  });

  it('tolerates GPS uncertainty when the NFC tag proves presence', () => {
    const edge = { lat: 38.72282, lng: -9.1393 }; // ~58 m, precisão 20 m
    const ctx = baseContext({ method: 'nfc', position: { ...edge, accuracy: 20, ageMs: 0 } });
    expect(evaluatePunch(ctx).rejected).toBeNull();
    expect(evaluatePunch({ ...ctx, method: 'gps' }).rejected).toBe('out_of_radius');
  });

  it('rejects poor accuracy and stale positions', () => {
    expect(
      evaluatePunch(baseContext({ position: { ...NEAR, accuracy: 150, ageMs: 0 } })).rejected
    ).toBe('low_accuracy');
    expect(
      evaluatePunch(baseContext({ position: { ...NEAR, accuracy: 10, ageMs: 5 * 60_000 } }))
        .rejected
    ).toBe('stale_position');
    expect(
      evaluatePunch(baseContext({ position: { lat: NaN, lng: 0, accuracy: 1, ageMs: 0 } })).rejected
    ).toBe('invalid_position');
  });

  it('flags VPN by default and blocks it when configured', () => {
    const ipInfo = { checked: true, isProxy: true, lat: 52.37, lng: 4.89 }; // Amesterdão
    const flagged = evaluatePunch(baseContext({ ipInfo }));
    expect(flagged.status).toBe('flagged');
    expect(flagged.flags).toEqual(expect.arrayContaining(['vpn_or_proxy', 'ip_far_from_location']));

    const location = { ...baseContext().location, blockVpn: true };
    expect(evaluatePunch(baseContext({ ipInfo, location })).rejected).toBe('vpn_blocked');
  });

  it('trusts the office network and skips IP checks', () => {
    const location = { ...baseContext().location, blockVpn: true, trustedIps: ['85.240.10.0/24'] };
    const result = evaluatePunch(
      baseContext({ location, ipInfo: { checked: true, isProxy: true } })
    );
    expect(result.rejected).toBeNull();
    expect(result.flags).toContain('trusted_network');
    expect(result.flags).not.toContain('vpn_or_proxy');
  });

  it('flags typical fake-GPS signals', () => {
    const perfect = evaluatePunch(baseContext({ position: { ...NEAR, accuracy: 1, ageMs: 0 } }));
    expect(perfect.flags).toContain('suspicious_accuracy');

    const repeated = evaluatePunch(
      baseContext({ repeatedCoordinates: true, position: { ...NEAR, accuracy: 5, ageMs: 0 } })
    );
    expect(repeated.flags).toContain('repeated_coordinates');

    // Wi-Fi positioning repete coordenadas com precisão larga: não é suspeito.
    const wifi = evaluatePunch(baseContext({ repeatedCoordinates: true }));
    expect(wifi.flags).not.toContain('repeated_coordinates');
  });

  it('flags impossible travel since the previous punch', () => {
    const now = baseContext().nowMs;
    const previous = { lat: 41.1579, lng: -8.6291, punchedAtMs: now - 30 * 60_000 }; // Porto há 30 min
    expect(evaluatePunch(baseContext({ previous })).flags).toContain('impossible_travel');
  });

  it('flags devices shared between employees', () => {
    const result = evaluatePunch(
      baseContext({ deviceUsedByOthers: true, deviceSeenBefore: false })
    );
    expect(result.status).toBe('flagged');
    expect(result.flags).toEqual(expect.arrayContaining(['shared_device', 'new_device']));
  });
});

describe('nextEntryType', () => {
  const now = Date.UTC(2026, 8, 23, 18, 0);
  it('alternates in → out within a shift and restarts after 16h', () => {
    expect(nextEntryType(null, now)).toBe('in');
    expect(nextEntryType({ entry_type: 'in', punchedAtMs: now - 8 * 3_600_000 }, now)).toBe('out');
    expect(nextEntryType({ entry_type: 'out', punchedAtMs: now - 3_600_000 }, now)).toBe('in');
    expect(nextEntryType({ entry_type: 'in', punchedAtMs: now - 20 * 3_600_000 }, now)).toBe('in');
  });
});

describe('sha256Hex', () => {
  it('hashes like the database/edge function expects', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
