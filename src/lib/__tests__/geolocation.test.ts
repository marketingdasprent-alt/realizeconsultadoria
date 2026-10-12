import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBestPosition } from '../geolocation';

const mockGeolocation = (timestamp: number, accuracy = 10) => {
  const watchPosition = vi.fn((onSuccess: PositionCallback) => {
    onSuccess({
      timestamp,
      coords: { latitude: 39.76, longitude: -8.8, accuracy } as GeolocationCoordinates,
    } as GeolocationPosition);
    return 1;
  });
  vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch: vi.fn() } });
};

describe('getBestPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not report a fresh reading as minutes old when the phone clock is wrong', async () => {
    // Carimbo do GPS 10 minutos atrás do relógio do telemóvel.
    mockGeolocation(Date.now() - 10 * 60 * 1000);
    const position = await getBestPosition();
    expect(position.age_ms).toBeLessThan(1000);
    expect(position.accuracy).toBe(10);
  });

  it('keeps a normal age for a correctly timestamped reading', async () => {
    mockGeolocation(Date.now());
    const position = await getBestPosition();
    expect(position.age_ms).toBeGreaterThanOrEqual(0);
    expect(position.age_ms).toBeLessThan(1000);
  });
});
