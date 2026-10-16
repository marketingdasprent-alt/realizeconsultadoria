import { describe, expect, it } from 'vitest';
import { groupTitle } from '../groupTitle';

describe('nome automático do grupo', () => {
  it('junta os primeiros nomes', () => {
    expect(groupTitle(['Ana', 'Arthur', 'Beatriz'])).toBe('Ana, Arthur e Beatriz');
    expect(groupTitle(['Ana', 'Rui'])).toBe('Ana e Rui');
  });
  it('a partir de 5 pessoas mostra 4 e "+N"', () => {
    expect(groupTitle(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A, B, C, D +2');
  });
  it('sem nomes fica "Grupo"', () => {
    expect(groupTitle([])).toBe('Grupo');
  });
});
