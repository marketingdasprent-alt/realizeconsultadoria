// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  REMOTE_ELIGIBLE_REASONS,
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
    const ipInfo = {
      checked: true,
      isProxy: true,
      proxyType: 'VPN',
      country: 'NL',
      lat: 52.37,
      lng: 4.89,
    }; // Amesterdão
    const flagged = evaluatePunch(baseContext({ ipInfo }));
    expect(flagged.status).toBe('flagged');
    expect(flagged.flags).toEqual(expect.arrayContaining(['vpn_or_proxy', 'ip_far_from_location']));

    const location = { ...baseContext().location, blockVpn: true };
    expect(evaluatePunch(baseContext({ ipInfo, location })).rejected).toBe('vpn_blocked');
  });

  it('does not block or review a mobile-carrier IP marked as SOCKS proxy (CGNAT)', () => {
    // Caso real: iPhone em dados móveis NOS no escritório; proxycheck diz "SOCKS5 / Webshare".
    const location = { ...baseContext().location!, blockVpn: true };
    const ipInfo = { checked: true, isProxy: true, proxyType: 'SOCKS5', country: 'PT' };
    const result = evaluatePunch(baseContext({ location, ipInfo }));
    expect(result.rejected).toBeNull();
    expect(result.status).toBe('valid');
    expect(result.flags).toContain('shared_ip_proxy');
    expect(result.flags).not.toContain('vpn_or_proxy');
  });

  it('blocks Tor like a VPN, and treats an unknown proxy type as shared', () => {
    const location = { ...baseContext().location!, blockVpn: true };
    expect(
      evaluatePunch(
        baseContext({ location, ipInfo: { checked: true, isProxy: true, proxyType: 'TOR' } })
      ).rejected
    ).toBe('vpn_blocked');
    expect(
      evaluatePunch(baseContext({ location, ipInfo: { checked: true, isProxy: true } })).rejected
    ).toBeNull();
  });

  it('does not flag Portuguese mobile IPs located far away (e.g. Azores)', () => {
    // Caso real: Android em dados móveis, IP em Ribeira Seca (Açores), pessoa no escritório.
    const ipInfo = { checked: true, isProxy: false, country: 'PT', lat: 37.76, lng: -25.53 };
    const result = evaluatePunch(baseContext({ ipInfo }));
    expect(result.flags).not.toContain('ip_far_from_location');
    expect(result.status).toBe('valid');
  });

  it('flags a foreign IP far from the GPS position', () => {
    const ipInfo = { checked: true, isProxy: false, country: 'BR', lat: -23.55, lng: -46.63 };
    const result = evaluatePunch(baseContext({ ipInfo }));
    expect(result.flags).toContain('ip_far_from_location');
    expect(result.status).toBe('flagged');
  });

  it('trusts the office network and skips IP checks', () => {
    const location = { ...baseContext().location, blockVpn: true, trustedIps: ['85.240.10.0/24'] };
    const result = evaluatePunch(
      baseContext({ location, ipInfo: { checked: true, isProxy: true, proxyType: 'VPN' } })
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

describe('evaluatePunch — trabalho remoto', () => {
  const HOME = { lat: 38.7569, lng: -9.2549 }; // ~11 km do escritório

  it('rejects outside the office with a reason that allows asking for remote', () => {
    const office = evaluatePunch(baseContext({ position: { ...HOME, accuracy: 15, ageMs: 0 } }));
    expect(office.rejected).toBe('out_of_radius');
    expect(REMOTE_ELIGIBLE_REASONS.has(office.rejected!)).toBe(true);
    expect(office.distanceM).toBeGreaterThan(10_000);
  });

  it('accepts a confirmed remote punch as pending, with the remote flag', () => {
    const remote = evaluatePunch(
      baseContext({ mode: 'remote', position: { ...HOME, accuracy: 15, ageMs: 0 } })
    );
    expect(remote.rejected).toBeNull();
    expect(remote.status).toBe('pending');
    expect(remote.flags).toContain('remote');
  });

  it('allows remote punches with poor GPS or no configured location', () => {
    const poor = evaluatePunch(
      baseContext({ mode: 'remote', position: { ...HOME, accuracy: 500, ageMs: 0 } })
    );
    expect(poor.status).toBe('pending');

    expect(evaluatePunch(baseContext({ location: null })).rejected).toBe('no_location');
    expect(evaluatePunch(baseContext({ mode: 'remote', location: null })).status).toBe('pending');
  });

  it('still blocks VPN and stale positions in remote mode', () => {
    const location = { ...baseContext().location!, blockVpn: true };
    const ipInfo = { checked: true, isProxy: true, proxyType: 'VPN' };
    expect(evaluatePunch(baseContext({ mode: 'remote', location, ipInfo })).rejected).toBe(
      'vpn_blocked'
    );
    expect(
      evaluatePunch(
        baseContext({ mode: 'remote', position: { ...HOME, accuracy: 10, ageMs: 5 * 60_000 } })
      ).rejected
    ).toBe('stale_position');
  });

  it('does not offer remote for tag or VPN problems', () => {
    for (const reason of ['invalid_tag', 'replayed_tag', 'vpn_blocked', 'stale_position']) {
      expect(REMOTE_ELIGIBLE_REASONS.has(reason)).toBe(false);
    }
  });
});

describe('nextEntryType', () => {
  const now = Date.UTC(2026, 8, 23, 18, 0);
  it('alternates in → out within a shift and restarts after 12h', () => {
    expect(nextEntryType(null, now)).toBe('in');
    expect(nextEntryType({ entry_type: 'in', punchedAtMs: now - 8 * 3_600_000 }, now)).toBe('out');
    expect(nextEntryType({ entry_type: 'out', punchedAtMs: now - 3_600_000 }, now)).toBe('in');
    expect(nextEntryType({ entry_type: 'in', punchedAtMs: now - 13 * 3_600_000 }, now)).toBe('in');
  });
});

describe('sha256Hex', () => {
  it('hashes like the database/edge function expects', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
