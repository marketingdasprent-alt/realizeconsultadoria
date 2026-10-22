import { describe, expect, it } from 'vitest';
import {
  addRecipients,
  recipientEmails,
  removeRecipient,
  suggestRecipients,
  type ContactEntry,
  type ContactList,
} from '../recipients';

const team: ContactEntry[] = [
  { email: 'ana.ferreira@realize.pt', name: 'Ana Ferreira' },
  { email: 'joao.silva@realize.pt', name: 'João Silva' },
];
const contacts: ContactEntry[] = [
  { email: 'cliente@empresa.com', name: 'Cliente Lda' },
  { email: 'ana.ferreira@realize.pt', name: null },
];
const lists: ContactList[] = [
  {
    id: 'l1',
    name: 'Equipa Marketing',
    members: [{ email: 'ana.ferreira@realize.pt', name: 'Ana Ferreira' }],
  },
  { id: 'l2', name: 'Vazia', members: [] },
];

describe('campo de destinatários', () => {
  it('adds without repeating and removes by email', () => {
    expect(addRecipients('a@x.pt', ['A@x.pt', 'b@y.pt'])).toBe('a@x.pt, b@y.pt');
    expect(removeRecipient('a@x.pt, b@y.pt', 'A@X.pt')).toBe('b@y.pt');
    expect(recipientEmails('Ana <a@x.pt>; b@y.pt, lixo')).toEqual(['a@x.pt', 'b@y.pt']);
  });
});

describe('suggestRecipients', () => {
  const base = { team, contacts, lists, exclude: [] as string[] };

  it('suggests lists first, then people already written, then the team', () => {
    const result = suggestRecipients({ ...base, query: 'a' });
    expect(result[0]).toMatchObject({ kind: 'list', name: 'Equipa Marketing' });
    const people = result.filter(item => item.kind === 'person');
    expect(people.map(item => item.key)).toContain('person:cliente@empresa.com');
  });

  it('ignores accents and case, and matches name or email', () => {
    expect(
      suggestRecipients({ ...base, query: 'joao' }).map(
        item => item.kind === 'person' && item.email
      )
    ).toContain('joao.silva@realize.pt');
    expect(
      suggestRecipients({ ...base, query: 'EMPRESA.COM' }).some(
        item => item.kind === 'person' && item.email === 'cliente@empresa.com'
      )
    ).toBe(true);
  });

  it('does not suggest who is already in the field, nor empty lists', () => {
    const result = suggestRecipients({
      ...base,
      query: 'ana',
      exclude: ['Ana.Ferreira@realize.pt'],
    });
    expect(result.some(item => item.kind === 'person')).toBe(false);
    expect(suggestRecipients({ ...base, query: 'vazia' })).toEqual([]);
  });

  it('shows the lists and the most used people when nothing is typed', () => {
    const result = suggestRecipients({ ...base, query: '' });
    expect(result[0].kind).toBe('list');
    expect(
      result.filter(item => item.kind === 'person').every(item => item.source === 'sent')
    ).toBe(true);
  });

  it('can leave lists out (inside a list itself)', () => {
    expect(
      suggestRecipients({ ...base, query: 'equipa', allowLists: false }).some(
        item => item.kind === 'list'
      )
    ).toBe(false);
  });

  it('keeps a person only once even if in the team and in contacts', () => {
    const result = suggestRecipients({ ...base, query: 'ferreira' });
    expect(result.filter(item => item.kind === 'person')).toHaveLength(1);
  });
});
