import { describe, expect, it } from 'vitest';
import type { MailSignature } from '../../types';
import { cleanSignatures, newSignature, pickSignature } from '../signatures';

const sig = (id: string, html: string, isDefault = false, name = id): MailSignature => ({
  id,
  name,
  html,
  isDefault,
});

describe('signatures', () => {
  it('the first signature of a mailbox is the default', () => {
    expect(newSignature([]).isDefault).toBe(true);
    expect(newSignature([sig('a', '<b>x</b>', true)]).isDefault).toBe(false);
  });

  it('drops empty ones, names them and keeps exactly one default', () => {
    const cleaned = cleanSignatures([
      sig('a', '', true, '  '),
      sig('b', '<b>Completa</b>', false, 'Completa'),
      sig('c', 'Linha 1\nLinha 2', true, 'Curta'),
    ]);
    expect(cleaned.map(s => s.id)).toEqual(['b', 'c']);
    expect(cleaned.filter(s => s.isDefault).map(s => s.id)).toEqual(['c']);
    expect(cleaned[1].html).toContain('Linha 1');
  });

  it('falls back to the first one when no default survives', () => {
    const cleaned = cleanSignatures([
      sig('a', '', true),
      sig('b', '<i>b</i>'),
      sig('c', '<i>c</i>'),
    ]);
    expect(cleaned.map(s => [s.id, s.isDefault])).toEqual([
      ['b', true],
      ['c', false],
    ]);
  });

  it('picks the default, none, or a specific one', () => {
    const list = [sig('a', 'A', true), sig('b', 'B')];
    expect(pickSignature(list, 'default')?.id).toBe('a');
    expect(pickSignature(list, 'b')?.id).toBe('b');
    expect(pickSignature(list, 'none')).toBeNull();
    expect(pickSignature([], 'default')).toBeNull();
  });
});
