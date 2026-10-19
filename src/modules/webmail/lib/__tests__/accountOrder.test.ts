import { describe, expect, it } from 'vitest';
import { applyAccountOrder, dropIndex, moveItem, sortByEmail } from '../accountOrder';

const accounts = [
  { id: 'a', email: 'rh@empresa.pt' },
  { id: 'b', email: 'Ana@empresa.pt' },
  { id: 'c', email: 'geral@empresa.pt' },
  { id: 'd', email: 'Álvaro@empresa.pt' },
];
const ids = (list: { id: string }[]) => list.map(a => a.id).join('');

describe('applyAccountOrder', () => {
  it('ordena pelas posições guardadas', () => {
    const positions = new Map([
      ['a', 3],
      ['b', 0],
      ['c', 2],
      ['d', 1],
    ]);
    expect(ids(applyAccountOrder(accounts, positions))).toBe('bdca');
  });

  it('põe as caixas sem posição no fim, pela ordem de antes', () => {
    const positions = new Map([
      ['c', 0],
      ['a', 1],
    ]);
    expect(ids(applyAccountOrder(accounts, positions))).toBe('cabd');
  });

  it('sem posições, mantém a ordem', () => {
    expect(ids(applyAccountOrder(accounts, new Map()))).toBe('abcd');
  });

  it('não altera a lista original', () => {
    applyAccountOrder(accounts, new Map([['d', 0]]));
    expect(ids(accounts)).toBe('abcd');
  });
});

describe('moveItem', () => {
  it('leva um item para baixo e para cima', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2).join('')).toBe('bcad');
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0).join('')).toBe('dabc');
  });

  it('ignora índices fora da lista e limita o destino', () => {
    expect(moveItem(['a', 'b'], 5, 0).join('')).toBe('ab');
    expect(moveItem(['a', 'b', 'c'], 0, 9).join('')).toBe('bca');
    expect(moveItem(['a', 'b', 'c'], 2, -1).join('')).toBe('cab');
  });
});

describe('sortByEmail', () => {
  it('ordena sem distinguir maiúsculas nem acentos', () => {
    expect(ids(sortByEmail(accounts))).toBe('dbca');
  });
});

describe('dropIndex', () => {
  // Linhas de 40 px: centros em 20, 60, 100, 140.
  const centers = [20, 60, 100, 140];

  it('arrastar a primeira para baixo da segunda', () => {
    expect(dropIndex(centers, 0, 70)).toBe(1);
    expect(dropIndex(centers, 0, 150)).toBe(3);
  });

  it('arrastar a última para cima', () => {
    expect(dropIndex(centers, 3, 10)).toBe(0);
    expect(dropIndex(centers, 3, 80)).toBe(2);
  });

  it('sem passar o centro da vizinha, fica no mesmo sítio', () => {
    expect(dropIndex(centers, 1, 50)).toBe(1);
    expect(dropIndex(centers, 1, 90)).toBe(1);
  });
});
