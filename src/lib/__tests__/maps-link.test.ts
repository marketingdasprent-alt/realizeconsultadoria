import { describe, expect, it } from 'vitest';
import {
  extractMapsCoordinates,
  isGoogleHost,
  isGoogleSearchLink,
  isShortMapsLink,
} from '../../../supabase/functions/_shared/maps-link';

describe('extractMapsCoordinates', () => {
  it('reads coordinates copied from the map', () => {
    expect(extractMapsCoordinates('38.72230, -9.13930')).toEqual({
      lat: 38.7223,
      lng: -9.1393,
      precision: 'pin',
    });
    expect(extractMapsCoordinates('38.7223 -9.1393')?.lng).toBe(-9.1393);
  });

  it('prefers the marked place over the map centre in place URLs', () => {
    const url =
      'https://www.google.com/maps/place/Pra%C3%A7a+do+Com%C3%A9rcio/@38.7075,-9.1400,17z/data=!3m1!4b1!4m6!3m5!1s0xd19347f8a4d7b1f:0x1!8m2!3d38.70798!4d-9.13653!16s%2Fm%2F02';
    expect(extractMapsCoordinates(url)).toEqual({ lat: 38.70798, lng: -9.13653, precision: 'pin' });
  });

  it('reads query-style links', () => {
    expect(extractMapsCoordinates('https://www.google.com/maps?q=38.7223,-9.1393')?.lat).toBe(
      38.7223
    );
    expect(extractMapsCoordinates('https://maps.google.com/?q=loc:38.7223,-9.1393')?.lat).toBe(
      38.7223
    );
    expect(
      extractMapsCoordinates('https://www.google.com/maps/search/?api=1&query=38.7223%2C-9.1393')
        ?.lng
    ).toBe(-9.1393);
    expect(
      extractMapsCoordinates('https://www.google.com/maps/search/38.7223,+-9.1393?entry=tts')?.lat
    ).toBe(38.7223);
  });

  it('marks map-centre links as viewport precision', () => {
    expect(extractMapsCoordinates('https://www.google.com/maps/@38.7223,-9.1393,17z')).toEqual({
      lat: 38.7223,
      lng: -9.1393,
      precision: 'viewport',
    });
  });

  it('follows the EU consent page continue parameter', () => {
    const inner = 'https://www.google.com/maps/place/X/data=!8m2!3d41.1579!4d-8.6291';
    const consent = `https://consent.google.com/ml?continue=${encodeURIComponent(inner)}&gl=PT`;
    expect(extractMapsCoordinates(consent)?.lat).toBe(41.1579);
  });

  it('ignores the generic static map centre found in Google Maps HTML', () => {
    // O HTML traz o centro da região do visitante (aqui: centro de Portugal), não o local.
    const html =
      '<meta content="https://maps.google.com/maps/api/staticmap?center=39.7036312%2C-8.7392256&amp;zoom=6" property="og:image">';
    expect(extractMapsCoordinates(html)).toBeNull();
  });

  it('rejects text without valid coordinates', () => {
    expect(extractMapsCoordinates('Rua Augusta, Lisboa')).toBeNull();
    expect(extractMapsCoordinates('100, 200')).toBeNull();
    expect(extractMapsCoordinates('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(extractMapsCoordinates('')).toBeNull();
  });
});

describe('link helpers', () => {
  it('detects Google web search links (no coordinates)', () => {
    expect(isGoogleSearchLink('https://www.google.com/search?q=rua+das+oliveiras+53')).toBe(true);
    expect(isGoogleSearchLink('https://www.google.pt/search?q=x')).toBe(true);
    expect(isGoogleSearchLink('https://www.google.com/maps/search/38.72,+-9.13')).toBe(false);
  });

  it('detects share short links', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/AbCdEf123')).toBe(true);
    expect(isShortMapsLink('https://www.google.com/maps?q=1,1')).toBe(false);
    expect(isShortMapsLink('not a link')).toBe(false);
  });

  it('only accepts Google hosts when following redirects', () => {
    expect(isGoogleHost('www.google.com')).toBe(true);
    expect(isGoogleHost('consent.google.com')).toBe(true);
    expect(isGoogleHost('www.google.pt')).toBe(true);
    expect(isGoogleHost('maps.app.goo.gl')).toBe(true);
    expect(isGoogleHost('google.com.evil.io')).toBe(false);
    expect(isGoogleHost('evilgoogle.com')).toBe(false);
  });
});
