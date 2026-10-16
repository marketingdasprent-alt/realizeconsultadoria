import { describe, expect, it } from 'vitest';
import { lisbonToUtc, matchPeople, utcToLisbon } from '../../../supabase/functions/_shared/ai/time';

describe('assistente: datas em hora de Lisboa', () => {
  it('no verão Lisboa está uma hora à frente de UTC', () => {
    expect(lisbonToUtc('2026-07-10T10:00')?.toISOString()).toBe('2026-07-10T09:00:00.000Z');
  });

  it('no inverno é igual a UTC', () => {
    expect(lisbonToUtc('2026-12-10T10:00')?.toISOString()).toBe('2026-12-10T10:00:00.000Z');
  });

  it('26 de outubro de 2026 (já em hora de inverno) e 17 de outubro (ainda verão)', () => {
    expect(lisbonToUtc('2026-10-17T10:00')?.toISOString()).toBe('2026-10-17T09:00:00.000Z');
    expect(lisbonToUtc('2026-10-27T10:00')?.toISOString()).toBe('2026-10-27T10:00:00.000Z');
  });

  it('ida e volta e datas inválidas', () => {
    expect(utcToLisbon(new Date('2026-07-10T09:00:00Z'))).toBe('2026-07-10T10:00');
    expect(lisbonToUtc('amanhã')).toBeNull();
    expect(lisbonToUtc('2026-10-17')?.toISOString()).toBe('2026-10-16T23:00:00.000Z');
  });
});

describe('assistente: encontrar colegas pelo nome', () => {
  const people = [
    { user_id: 'a', name: 'João Victor Da Silva Bahia' },
    { user_id: 'b', name: 'Joana Ferreira' },
    { user_id: 'c', name: 'Ana Ferreira' },
  ];
  it('ignora acentos e maiúsculas e aceita só parte do nome', () => {
    expect(matchPeople('joao bahia', people).map(p => p.user_id)).toEqual(['a']);
    expect(matchPeople('FERREIRA', people).map(p => p.user_id)).toEqual(['b', 'c']);
  });
  it('um nome exato ganha às parecidas', () => {
    expect(matchPeople('Ana Ferreira', people).map(p => p.user_id)).toEqual(['c']);
    expect(matchPeople('xyz', people)).toEqual([]);
  });
});
