import { describe, it, expect } from 'vitest';
import { isTransientQueryError, retryDelayMs } from '../retry';

describe('retryDelayMs', () => {
  it('duplica a espera a partir de 2 s e fica nos 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(retryDelayMs)).toEqual([
      2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });

  it('tentativa negativa conta como a primeira', () => {
    expect(retryDelayMs(-1)).toBe(2_000);
  });
});

describe('isTransientQueryError', () => {
  it('sem erro não é falha', () => {
    expect(isTransientQueryError(503, null)).toBe(false);
  });

  it('BD em baixo, a arrancar ou sem rede é passageiro', () => {
    expect(isTransientQueryError(503, { code: 'PGRST002' })).toBe(true);
    expect(isTransientQueryError(500, { code: 'XX000' })).toBe(true);
    expect(isTransientQueryError(521, { code: '' })).toBe(true);
    expect(isTransientQueryError(0, { code: '' })).toBe(true);
    expect(isTransientQueryError(408, { code: '' })).toBe(true);
    expect(isTransientQueryError(429, { code: '' })).toBe(true);
    expect(isTransientQueryError(200, { code: 'PGRST001' })).toBe(true);
  });

  it('não existe ou sem permissão não é passageiro', () => {
    expect(isTransientQueryError(404, { code: 'PGRST202' })).toBe(false);
    expect(isTransientQueryError(401, { code: 'PGRST301' })).toBe(false);
    expect(isTransientQueryError(403, { code: '42501' })).toBe(false);
    expect(isTransientQueryError(406, { code: 'PGRST116' })).toBe(false);
  });
});
