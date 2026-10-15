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

  it('PC com localização por Wi-Fi: usa a leitura quando deixa de melhorar (2 s, não 8 s)', async () => {
    vi.useFakeTimers();
    try {
      mockGeolocation(Date.now(), 150);
      let done = false;
      const promise = getBestPosition().then(p => {
        done = true;
        return p;
      });
      await vi.advanceTimersByTimeAsync(1900);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect((await promise).accuracy).toBe(150);
    } finally {
      vi.useRealTimers();
    }
  });

  it('continua a esperar enquanto a precisão melhora e para logo nos 25 m', async () => {
    vi.useFakeTimers();
    try {
      let emit: PositionCallback = () => undefined;
      const watchPosition = vi.fn((onSuccess: PositionCallback) => {
        emit = onSuccess;
        return 1;
      });
      vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch: vi.fn() } });
      const reading = (accuracy: number) =>
        ({
          timestamp: Date.now(),
          coords: { latitude: 39.76, longitude: -8.8, accuracy } as GeolocationCoordinates,
        }) as GeolocationPosition;
      const promise = getBestPosition();
      emit(reading(300));
      await vi.advanceTimersByTimeAsync(1500);
      emit(reading(120));
      await vi.advanceTimersByTimeAsync(1500);
      emit(reading(18));
      expect((await promise).accuracy).toBe(18);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a normal age for a correctly timestamped reading', async () => {
    mockGeolocation(Date.now());
    const position = await getBestPosition();
    expect(position.age_ms).toBeGreaterThanOrEqual(0);
    expect(position.age_ms).toBeLessThan(1000);
  });
});
