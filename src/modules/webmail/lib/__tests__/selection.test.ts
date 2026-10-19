import { describe, expect, it } from 'vitest';
import { toggleAllSelection, toggleSelection } from '../selection';

const order = ['a', 'b', 'c', 'd', 'e'];
const sorted = (set: Set<string>) => [...set].sort().join('');

describe('toggleSelection', () => {
  it('marca e desmarca um email', () => {
    const one = toggleSelection(order, new Set(), 'b', null, false);
    expect(sorted(one)).toBe('b');
    expect(sorted(toggleSelection(order, one, 'b', 'b', false))).toBe('');
  });

  it('com Shift marca o intervalo desde a âncora (nos dois sentidos)', () => {
    expect(sorted(toggleSelection(order, new Set(['b']), 'd', 'b', true))).toBe('bcd');
    expect(sorted(toggleSelection(order, new Set(['d']), 'a', 'd', true))).toBe('abcd');
  });

  it('com Shift num email marcado desmarca o intervalo', () => {
    const all = new Set(order);
    expect(sorted(toggleSelection(order, all, 'd', 'b', true))).toBe('ae');
  });

  it('sem âncora, ou com a âncora fora da lista, marca só o clicado', () => {
    expect(sorted(toggleSelection(order, new Set(), 'c', null, true))).toBe('c');
    expect(sorted(toggleSelection(order, new Set(), 'c', 'zz', true))).toBe('c');
  });

  it('não altera o conjunto original', () => {
    const current = new Set(['a']);
    toggleSelection(order, current, 'e', 'a', true);
    expect(sorted(current)).toBe('a');
  });
});

describe('toggleAllSelection', () => {
  it('marca todos os da página', () => {
    expect(sorted(toggleAllSelection(order, new Set(['b'])))).toBe('abcde');
  });

  it('desmarca tudo quando já estavam todos', () => {
    expect(sorted(toggleAllSelection(order, new Set(order)))).toBe('');
  });

  it('página vazia fica sem seleção', () => {
    expect(sorted(toggleAllSelection([], new Set()))).toBe('');
  });
});
