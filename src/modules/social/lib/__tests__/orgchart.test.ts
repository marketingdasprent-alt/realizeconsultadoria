import { describe, expect, it } from 'vitest';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { NO_DEPARTMENT, buildOrgChart, isLead, rankOf } from '../orgchart';

const person = (name: string, department: string | null, position: string | null = null) =>
  ({
    userId: name,
    employeeId: name,
    name,
    department,
    position,
    email: null,
  }) satisfies DirectoryPerson;

const PEOPLE = [
  person('Rui', 'Operações', 'Motorista'),
  person('Ana', 'Operações', 'Coordenadora'),
  person('Marta', 'Direção', 'Diretora'),
  person('Pedro', null, 'Estagiário'),
  person('Inês', 'Financeiro', 'Contabilista'),
];

describe('organograma', () => {
  it('reconhece cargos de chefia', () => {
    expect(isLead({ position: 'Gestora de Operações' })).toBe(true);
    expect(isLead({ position: 'Responsável de Armazém' })).toBe(true);
    expect(isLead({ position: 'Motorista' })).toBe(false);
    expect(isLead({ position: null })).toBe(false);
  });

  it('põe a direção no topo e "Outros" no fim', () => {
    const chart = buildOrgChart(PEOPLE);
    expect(chart.board?.name).toBe('Direção');
    expect(chart.departments.map(d => d.name)).toEqual(['Financeiro', 'Operações', NO_DEPARTMENT]);
    expect(chart.total).toBe(5);
  });

  it('coroa só para a direção; gestores por baixo do diretor', () => {
    const tvde = buildOrgChart([
      person('Luiz', 'TVDE', 'Diretor TVDE'),
      person('Ana', 'TVDE', 'Gestor TVDE'),
      person('Bruno', 'TVDE', 'Assist. TVDE'),
      person('Rui', 'Frota', 'Gestor de Frota'),
    ]).departments;
    const dept = tvde.find(d => d.name === 'TVDE');
    expect(dept?.people.map(p => p.name)).toEqual(['Luiz', 'Ana', 'Bruno']);
    expect(dept?.leads).toEqual(['Luiz']);
    expect(tvde.find(d => d.name === 'Frota')?.leads).toEqual([]);
    expect(rankOf('CEO')).toBe(2);
    expect(rankOf('Chefe de Oficina')).toBe(1);
    expect(rankOf('Mecânico')).toBe(0);
  });

  it('chefias primeiro dentro do departamento', () => {
    const ops = buildOrgChart(PEOPLE).departments.find(d => d.name === 'Operações');
    expect(ops?.people.map(p => p.name)).toEqual(['Ana', 'Rui']);
  });

  it('pesquisa por pessoa ou por departamento', () => {
    expect(buildOrgChart(PEOPLE, 'rui').departments.map(d => d.name)).toEqual(['Operações']);
    expect(buildOrgChart(PEOPLE, 'rui').board).toBeNull();
    const byDept = buildOrgChart(PEOPLE, 'opera');
    expect(byDept.departments[0].people).toHaveLength(2);
    expect(buildOrgChart(PEOPLE, 'xyz').total).toBe(0);
  });
});
