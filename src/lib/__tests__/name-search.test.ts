import { describe, expect, it } from 'vitest';
import { matchesNameSearch } from '../timeclock';

describe('matchesNameSearch', () => {
  it('searches names ignoring accents, case and word order', () => {
    const name = 'João Victor Da Silva Bahia';
    expect(matchesNameSearch(name, '')).toBe(true);
    expect(matchesNameSearch(name, 'joao')).toBe(true);
    expect(matchesNameSearch(name, 'BAHIA joão')).toBe(true);
    expect(matchesNameSearch(name, 'silv')).toBe(true);
    expect(matchesNameSearch(name, 'joao sousa')).toBe(false);
    expect(matchesNameSearch(null, 'joao')).toBe(false);
  });
});
