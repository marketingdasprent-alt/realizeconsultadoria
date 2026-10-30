import { describe, expect, it } from 'vitest';
import {
  insertMention,
  mentionedIds,
  mentionParts,
  mentionQuery,
  mentionSuggestions,
} from '../mentions';

const people = [
  { userId: 'a', name: 'Ana Silva' },
  { userId: 'b', name: 'Bruno Paulo' },
  { userId: 'c', name: 'Álvaro Costa' },
];

describe('marcar pessoas (@)', () => {
  it('só abre a lista com @ no início ou depois de um espaço', () => {
    expect(mentionQuery('Olá @an', 7)).toEqual({ start: 4, query: 'an' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQuery('mail@an', 7)).toBeNull();
    expect(mentionQuery('Olá @an ', 8)).toBeNull();
  });

  it('procura por qualquer nome, sem acentos', () => {
    expect(mentionSuggestions(people, 'al').map(p => p.userId)).toEqual(['c']);
    expect(mentionSuggestions(people, 'pau').map(p => p.userId)).toEqual(['b']);
    expect(mentionSuggestions(people, '')).toHaveLength(3);
  });

  it('insere o nome e conta só quem ficou no texto', () => {
    const { text, caret } = insertMention('Olá @an tudo bem', 4, 7, 'Ana Silva');
    expect(text).toBe('Olá @Ana Silva  tudo bem');
    expect(caret).toBe(15);
    expect(mentionedIds(text, [people[0], people[1]])).toEqual(['a']);
  });

  it('destaca os @Nome das pessoas marcadas', () => {
    expect(mentionParts('Oi @Ana Silva e @Bruno Paulo!', ['Ana Silva', 'Bruno Paulo'])).toEqual([
      { text: 'Oi ', mention: false },
      { text: '@Ana Silva', mention: true },
      { text: ' e ', mention: false },
      { text: '@Bruno Paulo', mention: true },
      { text: '!', mention: false },
    ]);
    expect(mentionParts('sem nada', [])).toEqual([{ text: 'sem nada', mention: false }]);
  });
});

describe('@ escrito à mão', () => {
  const team = [
    { userId: 't', name: 'Thiago Sousa' },
    { userId: 'a1', name: 'Ana Silva' },
    { userId: 'a2', name: 'Ana Costa' },
  ];
  it('marca quando o primeiro nome é de uma só pessoa', () => {
    expect(mentionedIds('@thiago mandei no whats', [], team)).toEqual(['t']);
    expect(mentionedIds('olá @Thiago!', [], team)).toEqual(['t']);
    expect(mentionedIds('@ana vê isto', [], team)).toEqual([]);
    expect(mentionedIds('@anasilva vê isto', [], team)).toEqual(['a1']);
    expect(mentionedIds('email ana@x.pt', [], team)).toEqual([]);
  });
});
