// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  REMOTE_ELIGIBLE_REASONS,
  applyManualTime,
  decidePunch,
  evaluatePunch,
  formatOsmAddress,
  formatPhotonAddress,
  haversineMeters,
  ipMatchesAny,
  nextEntryType,
  parseManualTime,
  sha256Hex,
  shouldNotifyApprovers,
  type DecideContext,
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

  it('accepts an NFC punch with imprecise GPS (the tag proves presence)', () => {
    // Caso real: iPhone na tag do escritório com GPS a ±10 km.
    const ctx = baseContext({ method: 'nfc', position: { ...NEAR, accuracy: 10_516, ageMs: 0 } });
    const result = evaluatePunch(ctx);
    expect(result.rejected).toBeNull();
    expect(result.flags).toContain('imprecise_gps');
    expect(result.status).toBe('valid');
  });

  it('tells manual punches with approximate location apart from merely weak GPS', () => {
    const approx = evaluatePunch(baseContext({ position: { ...NEAR, accuracy: 1_986, ageMs: 0 } }));
    expect(approx.rejected).toBe('approximate_location');
    expect(REMOTE_ELIGIBLE_REASONS.has('approximate_location')).toBe(true);
    const weak = evaluatePunch(baseContext({ position: { ...NEAR, accuracy: 150, ageMs: 0 } }));
    expect(weak.rejected).toBe('low_accuracy');
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

describe('decidePunch — regista sempre (como o Bitrix24)', () => {
  const HOME = { lat: 38.7569, lng: -9.2549 }; // ~11 km do escritório
  const decideContext = (overrides: Partial<DecideContext> = {}): DecideContext => ({
    ...baseContext(),
    action: 'start',
    manualNotAllowed: false,
    trustedNetwork: false,
    ...overrides,
  });
  const vpn = { checked: true, isProxy: true, proxyType: 'VPN' };

  it('validates a punch inside the radius', () => {
    const result = decidePunch(decideContext());
    expect(result).toMatchObject({ rejected: null, status: 'valid', presence: 'location' });
  });

  it('registers outside the offices as valid (several offices), with the reason', () => {
    const result = decidePunch(decideContext({ position: { ...HOME, accuracy: 15, ageMs: 0 } }));
    expect(result.rejected).toBeNull();
    expect(result.status).toBe('valid');
    expect(result.presence).toBeNull();
    expect(result.flags).toContain('outside_location');
    expect(result.flags).not.toContain('remote');
    expect(result.distanceM).toBeGreaterThan(10_000);
  });

  it('never asks approval for a pause, wherever it is made', () => {
    const outside = decidePunch(
      decideContext({ action: 'pause', position: { ...HOME, accuracy: 15, ageMs: 0 } })
    );
    expect(outside.status).toBe('valid');
    expect(outside.flags).toContain('outside_location');
    expect(outside.flags).not.toContain('remote');

    const noGps = decidePunch(decideContext({ action: 'pause', position: null }));
    expect(noGps.status).toBe('valid');
    expect(noGps.flags).toContain('no_gps');
  });

  it('registers without GPS as valid, with the reason in the flags', () => {
    const result = decidePunch(decideContext({ position: null }));
    expect(result.status).toBe('valid');
    expect(result.flags).toEqual(expect.arrayContaining(['no_gps', 'gps_only']));

    const stale = decidePunch(
      decideContext({ position: { ...NEAR, accuracy: 10, ageMs: 5 * 60_000 } })
    );
    expect(stale.status).toBe('valid');
    expect(stale.flags).toContain('stale_gps');
  });

  it('accepts weak or approximate GPS, with a clear reason', () => {
    const weak = decidePunch(decideContext({ position: { ...NEAR, accuracy: 150, ageMs: 0 } }));
    expect(weak.status).toBe('valid');
    expect(weak.flags).toContain('weak_gps');

    const approx = decidePunch(decideContext({ position: { ...NEAR, accuracy: 1_986, ageMs: 0 } }));
    expect(approx.status).toBe('valid');
    expect(approx.flags).toContain('approximate_location');
  });

  it('accepts the office Wi-Fi as presence, with or without GPS', () => {
    const noGps = decidePunch(decideContext({ position: null, trustedNetwork: true }));
    expect(noGps).toMatchObject({ status: 'valid', presence: 'network' });
    expect(noGps.flags).toEqual(expect.arrayContaining(['no_gps', 'trusted_network']));

    const badGps = decidePunch(
      decideContext({ trustedNetwork: true, position: { ...HOME, accuracy: 15, ageMs: 0 } })
    );
    expect(badGps).toMatchObject({ status: 'valid', presence: 'network' });
    expect(badGps.flags).toContain('outside_location');

    const shared = decidePunch(
      decideContext({ position: null, trustedNetwork: true, deviceUsedByOthers: true })
    );
    expect(shared.status).toBe('flagged');
  });

  it('accepts a tag without GPS, and a tag pause, as valid', () => {
    const tag = decidePunch(decideContext({ method: 'nfc', position: null }));
    expect(tag).toMatchObject({ status: 'valid', presence: 'tag' });
    const pause = decidePunch(decideContext({ method: 'nfc', action: 'pause', position: null }));
    expect(pause).toMatchObject({ status: 'valid', presence: 'tag' });
  });

  it('keeps tag-only locations: manual punch inside the radius waits for approval', () => {
    const result = decidePunch(decideContext({ manualNotAllowed: true }));
    expect(result.status).toBe('pending');
    expect(result.flags).toContain('tag_required');
    const onWifi = decidePunch(decideContext({ manualNotAllowed: true, trustedNetwork: true }));
    expect(onWifi.status).toBe('pending');
    const pause = decidePunch(decideContext({ manualNotAllowed: true, action: 'pause' }));
    expect(pause.status).toBe('valid');
  });

  it('still sends fraud signals to review when outside the offices', () => {
    const shared = decidePunch(
      decideContext({ position: { ...HOME, accuracy: 15, ageMs: 0 }, deviceUsedByOthers: true })
    );
    expect(shared.status).toBe('flagged');
    const fake = decidePunch(decideContext({ position: { ...HOME, accuracy: 1, ageMs: 0 } }));
    expect(fake.status).toBe('flagged');
  });

  it('registers companies without locations as valid', () => {
    const result = decidePunch(decideContext({ location: null }));
    expect(result.status).toBe('valid');
    expect(result.flags).toContain('no_location_configured');
  });

  it('treats old app versions (no action) like a start', () => {
    const result = decidePunch(
      decideContext({ action: null, position: { ...HOME, accuracy: 15, ageMs: 0 } })
    );
    expect(result.status).toBe('valid');
  });

  it('only refuses VPN/Tor when the location blocks it', () => {
    const location = { ...baseContext().location!, blockVpn: true };
    expect(decidePunch(decideContext({ location, ipInfo: vpn })).rejected).toBe('vpn_blocked');
    expect(
      decidePunch(
        decideContext({ location, ipInfo: vpn, position: { ...HOME, accuracy: 15, ageMs: 0 } })
      ).rejected
    ).toBe('vpn_blocked');
    expect(decidePunch(decideContext({ location, ipInfo: vpn, position: null })).rejected).toBe(
      'vpn_blocked'
    );

    const allowed = decidePunch(decideContext({ ipInfo: vpn }));
    expect(allowed.rejected).toBeNull();
    expect(allowed.status).toBe('flagged');
    expect(allowed.flags).toContain('vpn_or_proxy');
  });
});

describe('correção de hora (✎)', () => {
  const now = Date.UTC(2026, 9, 14, 16, 40);

  it('accepts a time in the last 12 hours and nothing else', () => {
    expect(parseManualTime(undefined, now)).toBeNull();
    expect(parseManualTime('', now)).toBeNull();
    expect(parseManualTime('2026-10-14T13:00:00Z', now)).toBe(Date.UTC(2026, 9, 14, 13, 0));
    expect(parseManualTime('2026-10-14T16:50:00Z', now)).toBe('invalid'); // futuro
    expect(parseManualTime('2026-10-14T04:00:00Z', now)).toBe('invalid'); // > 12 h
    expect(parseManualTime('ontem', now)).toBe('invalid');
    expect(parseManualTime(1_700_000_000_000, now)).toBe('invalid');
  });

  it('always waits for HR approval, flagged as manual_time', () => {
    const valid = {
      rejected: null,
      status: 'valid',
      flags: ['gps_only'],
      distanceM: 12,
      presence: 'location',
    } as const;
    const result = applyManualTime({ ...valid, flags: [...valid.flags] });
    expect(result.status).toBe('pending');
    expect(result.flags).toEqual(['gps_only', 'manual_time']);
    expect(applyManualTime(result).flags).toEqual(['gps_only', 'manual_time']);
  });
});

describe('shouldNotifyApprovers', () => {
  it('stays quiet when the only issue is the location', () => {
    expect(shouldNotifyApprovers('pending', ['outside_location', 'remote', 'gps_only'])).toBe(
      false
    );
    expect(shouldNotifyApprovers('pending', ['no_gps', 'remote', 'new_device'])).toBe(false);
    expect(shouldNotifyApprovers('pending', ['weak_gps', 'remote'])).toBe(false);
    expect(shouldNotifyApprovers('valid', ['gps_only'])).toBe(false);
  });

  it('emails HR for suspicious signals and time corrections', () => {
    expect(shouldNotifyApprovers('flagged', ['no_gps'])).toBe(true);
    expect(shouldNotifyApprovers('pending', ['outside_location', 'vpn_or_proxy'])).toBe(true);
    expect(shouldNotifyApprovers('pending', ['outside_location', 'shared_device'])).toBe(true);
    expect(shouldNotifyApprovers('pending', ['manual_time'])).toBe(true);
  });
});

describe('formatOsmAddress', () => {
  it('builds a short street + place line', () => {
    expect(
      formatOsmAddress({
        road: 'Rua das Oliveiras',
        house_number: '12',
        suburb: 'Marrazes',
        city: 'Leiria',
      })
    ).toBe('Rua das Oliveiras 12, Leiria');
    expect(
      formatOsmAddress({ road: 'Rua da Ferraria', village: 'São Romão', municipality: 'Leiria' })
    ).toBe('Rua da Ferraria, São Romão');
    expect(formatOsmAddress({ neighbourhood: 'Quinta do Lago', town: 'Oeiras' })).toBe(
      'Quinta do Lago, Oeiras'
    );
    expect(formatOsmAddress({ city: 'Leiria' })).toBe('Leiria');
    expect(formatOsmAddress({ hamlet: 'Leiria', city: 'Leiria' })).toBe('Leiria');
    expect(formatOsmAddress({})).toBeNull();
    expect(formatOsmAddress(null)).toBeNull();
  });
});

describe('formatPhotonAddress', () => {
  it('formats a Photon result like the Nominatim one', () => {
    expect(
      formatPhotonAddress({ street: 'Rua da Quinta', housenumber: '42', city: 'Leiria' })
    ).toBe('Rua da Quinta 42, Leiria');
    expect(
      formatPhotonAddress({ osm_key: 'highway', name: 'Rua da Quinta', district: 'São Romão' })
    ).toBe('Rua da Quinta, São Romão');
    expect(formatPhotonAddress({ locality: 'Vale do Mocho', city: 'Leiria' })).toBe(
      'Vale do Mocho, Leiria'
    );
    expect(formatPhotonAddress(null)).toBeNull();
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
