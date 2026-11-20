import { describe, expect, it } from 'vitest';
import { descendantsOf } from '../managerChain';

// Chefia: Marta > Ana > (Rui, Pedro > Inês); Luís sem responsável.
const PEOPLE = [
  { id: 'marta', manager_id: null },
  { id: 'ana', manager_id: 'marta' },
  { id: 'rui', manager_id: 'ana' },
  { id: 'pedro', manager_id: 'ana' },
  { id: 'ines', manager_id: 'pedro' },
  { id: 'luis', manager_id: null },
];

describe('cadeia de chefia (responsável direto)', () => {
  it('a equipa inclui diretos e indiretos, sem a própria pessoa', () => {
    expect([...descendantsOf('marta', PEOPLE)].sort()).toEqual(['ana', 'ines', 'pedro', 'rui']);
    expect([...descendantsOf('ana', PEOPLE)].sort()).toEqual(['ines', 'pedro', 'rui']);
  });

  it('quem não chefia ninguém tem equipa vazia', () => {
    expect(descendantsOf('rui', PEOPLE).size).toBe(0);
    expect(descendantsOf('luis', PEOPLE).size).toBe(0);
    expect(descendantsOf('desconhecido', PEOPLE).size).toBe(0);
  });

  it('resiste a ciclos e não inclui a própria pessoa', () => {
    const cycle = [
      { id: 'a', manager_id: 'c' },
      { id: 'b', manager_id: 'a' },
      { id: 'c', manager_id: 'b' },
    ];
    expect([...descendantsOf('a', cycle)].sort()).toEqual(['b', 'c']);
  });
});
