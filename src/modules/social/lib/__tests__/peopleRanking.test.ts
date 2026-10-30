import { describe, expect, it } from 'vitest';
import { rankPeople } from '../peopleRanking';

const people = [
  { userId: 'ana', name: 'Ana', department: 'Marketing' },
  { userId: 'bruno', name: 'Bruno', department: 'Financeiro' },
  { userId: 'carla', name: 'Carla', department: 'Marketing' },
  { userId: 'duarte', name: 'Duarte', department: null },
];

describe('ordem das pessoas nos seletores', () => {
  it('recentes, depois o meu departamento, depois as outras por nome', () => {
    const sections = rankPeople(people, ['bruno'], 'Marketing');
    expect(sections.map(s => [s.group, s.people.map(p => p.userId)])).toEqual([
      ['recent', ['bruno']],
      ['department', ['ana', 'carla']],
      ['others', ['duarte']],
    ]);
  });

  it('quem já está nos recentes não se repete; grupos vazios saem', () => {
    const sections = rankPeople(people, ['carla', 'quem-saiu'], 'Marketing');
    expect(sections.map(s => [s.group, s.people.map(p => p.userId)])).toEqual([
      ['recent', ['carla']],
      ['department', ['ana']],
      ['others', ['bruno', 'duarte']],
    ]);
    expect(rankPeople(people, [], null).map(s => s.group)).toEqual(['others']);
  });
});
