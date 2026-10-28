import { describe, expect, it } from 'vitest';
import {
  applyReaction,
  reactionsOf,
  tallyReactions,
  type NoticeReactionRow,
} from '../noticeReactions';

const rows: NoticeReactionRow[] = [
  { notification_id: 'n1', user_id: 'ana', emoji: '🎃' },
  { notification_id: 'n1', user_id: 'rui', emoji: '👻' },
  { notification_id: 'n1', user_id: 'eva', emoji: '👻' },
  { notification_id: 'n2', user_id: 'ana', emoji: '👍' },
];

describe('reações aos comunicados', () => {
  it('conta por emoji, o mais votado primeiro', () => {
    expect(reactionsOf(rows, 'n1', 'ana')).toEqual([
      { emoji: '👻', count: 2, mine: false },
      { emoji: '🎃', count: 1, mine: true },
    ]);
  });

  it('marca quem vai à frente (empates contam os dois)', () => {
    const tally = tallyReactions(rows.filter(r => r.notification_id === 'n1'));
    expect(tally.map(t => [t.emoji, t.leading])).toEqual([
      ['👻', true],
      ['🎃', false],
    ]);
    const tie = tallyReactions([
      { user_id: 'a', emoji: '1️⃣' },
      { user_id: 'b', emoji: '2️⃣' },
    ]);
    expect(tie.every(t => t.leading)).toBe(true);
    expect(tallyReactions([])).toEqual([]);
  });

  it('uma reação por pessoa: outro emoji troca o voto, o mesmo retira-o', () => {
    const changed = applyReaction(rows, 'n1', 'ana', '👻');
    expect(changed.emoji).toBe('👻');
    expect(reactionsOf(changed.rows, 'n1', 'ana')).toEqual([{ emoji: '👻', count: 3, mine: true }]);
    const removed = applyReaction(changed.rows, 'n1', 'ana', '👻');
    expect(removed.emoji).toBeNull();
    expect(reactionsOf(removed.rows, 'n1', 'ana')).toEqual([
      { emoji: '👻', count: 2, mine: false },
    ]);
    // A reação noutro comunicado não mexe.
    expect(removed.rows.filter(r => r.notification_id === 'n2')).toHaveLength(1);
  });
});
