import { describe, expect, it } from 'vitest';
import { likePattern, matchesTerm, normalize, snippet } from '../searchRules';

describe('pesquisa global', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(normalize('Férias de VERÃO')).toBe('ferias de verao');
    expect(matchesTerm('ferias', 'Pedido de Férias')).toBe(true);
    expect(matchesTerm('reuniao', null, 'Reunião de equipa')).toBe(true);
    expect(matchesTerm('xyz', 'Reunião')).toBe(false);
  });

  it('escapa os curingas do ILIKE', () => {
    expect(likePattern(' 50% ')).toBe('%50\\%%');
    expect(likePattern('a_b')).toBe('%a\\_b%');
  });

  it('corta um excerto à volta do termo', () => {
    const text = `${'a '.repeat(60)}encontrar aqui ${'b '.repeat(60)}`;
    const cut = snippet(text, 'encontrar', 10);
    expect(cut.startsWith('…')).toBe(true);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).toContain('encontrar');
    expect(snippet('Curto', 'curto')).toBe('Curto');
  });
});
