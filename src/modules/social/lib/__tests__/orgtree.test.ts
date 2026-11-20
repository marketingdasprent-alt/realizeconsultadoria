import { describe, expect, it } from 'vitest';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { buildOrgTree, hasManagerChain } from '../orgchart';

const person = (name: string, manager: string | null = null, position: string | null = null) =>
  ({
    userId: `u-${name}`,
    employeeId: name,
    name,
    department: null,
    position,
    email: null,
    managerEmployeeId: manager,
  }) satisfies DirectoryPerson;

// Marta > Ana > (Rui, Pedro > Inês); Luís e Zé sem chefia nem equipa.
const PEOPLE = [
  person('Rui', 'Ana', 'Motorista'),
  person('Ana', 'Marta', 'Coordenadora'),
  person('Marta', null, 'Diretora'),
  person('Pedro', 'Ana', 'Chefe de turno'),
  person('Inês', 'Pedro', 'Motorista'),
  person('Luís', null, 'Contabilista'),
  person('Zé', null, 'Estagiário'),
];

const names = (nodes: { person: DirectoryPerson }[]) => nodes.map(n => n.person.name);

describe('organograma pela chefia real', () => {
  it('só há árvore quando alguém tem o responsável no diretório', () => {
    expect(hasManagerChain(PEOPLE)).toBe(true);
    expect(hasManagerChain(PEOPLE.map(p => ({ ...p, managerEmployeeId: null })))).toBe(false);
    // Responsável fora do diretório (inativo, outra lista) não conta.
    expect(hasManagerChain([person('Rui', 'Fantasma')])).toBe(false);
    expect(hasManagerChain([])).toBe(false);
  });

  it('monta a árvore com tamanho da equipa e põe à parte quem não tem chefia', () => {
    const tree = buildOrgTree(PEOPLE);
    expect(names(tree.roots)).toEqual(['Marta']);
    const marta = tree.roots[0];
    expect(marta.teamSize).toBe(4);
    expect(names(marta.children)).toEqual(['Ana']);
    expect(names(marta.children[0].children)).toEqual(['Pedro', 'Rui']);
    expect(marta.children[0].teamSize).toBe(3);
    expect(marta.children[0].children[0].teamSize).toBe(1);
    expect(tree.unassigned.map(p => p.name)).toEqual(['Luís', 'Zé']);
    expect(tree.total).toBe(7);
  });

  it('pesquisa mantém a cadeia acima de quem corresponde', () => {
    const tree = buildOrgTree(PEOPLE, 'Inês');
    expect(tree.total).toBe(4);
    expect(names(tree.roots)).toEqual(['Marta']);
    expect(names(tree.roots[0].children[0].children)).toEqual(['Pedro']);
    expect(names(tree.roots[0].children[0].children[0].children)).toEqual(['Inês']);
    expect(tree.unassigned).toEqual([]);
  });

  it('pesquisa sem resultados devolve vazio', () => {
    const tree = buildOrgTree(PEOPLE, 'xyz');
    expect(tree.total).toBe(0);
    expect(tree.roots).toEqual([]);
    expect(tree.unassigned).toEqual([]);
  });

  it('responsável fora do diretório: a pessoa sobe ao topo', () => {
    const tree = buildOrgTree([person('Rui', 'Fantasma'), person('Ana'), person('Inês', 'Ana')]);
    expect(names(tree.roots)).toEqual(['Ana']);
    expect(tree.unassigned.map(p => p.name)).toEqual(['Rui']);
  });

  it('ciclo na chefia: ninguém desaparece nem repete', () => {
    const tree = buildOrgTree([person('A', 'B'), person('B', 'A'), person('C')]);
    const all: string[] = [];
    const walk = (nodes: typeof tree.roots) =>
      nodes.forEach(n => {
        all.push(n.person.name);
        walk(n.children);
      });
    walk(tree.roots);
    expect(all.sort()).toEqual(['A', 'B']);
    expect(tree.unassigned.map(p => p.name)).toEqual(['C']);
  });

  it('chefias de topo maiores primeiro', () => {
    const tree = buildOrgTree([
      person('Ana'),
      person('X', 'Ana'),
      person('Bruno'),
      person('Y', 'Bruno'),
      person('Z', 'Bruno'),
    ]);
    expect(names(tree.roots)).toEqual(['Bruno', 'Ana']);
  });
});
