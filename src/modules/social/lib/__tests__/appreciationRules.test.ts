import { describe, expect, it } from 'vitest';
import { groupReactors } from '../feed';
import { APPRECIATION_MIN_MESSAGE, messageShortfall } from '../appreciationRules';

describe('messageShortfall', () => {
  it('asks for a real reason: empty and short messages are not enough', () => {
    expect(messageShortfall('')).toBe(APPRECIATION_MIN_MESSAGE);
    expect(messageShortfall('   Obrigado   ')).toBe(APPRECIATION_MIN_MESSAGE - 8);
  });

  it('accepts a message that explains the work', () => {
    expect(messageShortfall('Fechou o relatório mensal antes do prazo e sem erros.')).toBe(0);
  });
});

describe('groupReactors', () => {
  it('groups people by emoji keeping first-seen order', () => {
    expect(
      groupReactors([
        { user_id: 'a', emoji: '🎉' },
        { user_id: 'b', emoji: '❤️' },
        { user_id: 'c', emoji: '🎉' },
      ])
    ).toEqual([
      { emoji: '🎉', userIds: ['a', 'c'] },
      { emoji: '❤️', userIds: ['b'] },
    ]);
  });
});
