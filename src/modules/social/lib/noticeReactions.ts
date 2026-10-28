// Reações aos comunicados: uma por pessoa (dá para votações), trocar de emoji troca o voto.

export interface NoticeReactionRow {
  notification_id: string;
  user_id: string;
  emoji: string;
}

export interface NoticeReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ReactionTally {
  emoji: string;
  count: number;
  userIds: string[];
  /** Tem mais votos (empates contam todos). */
  leading: boolean;
}

/** Contagem por emoji (mais votado primeiro), com o que eu escolhi. */
export const reactionsOf = (
  rows: NoticeReactionRow[],
  noticeId: string,
  me: string
): NoticeReaction[] =>
  tallyReactions(rows.filter(row => row.notification_id === noticeId)).map(tally => ({
    emoji: tally.emoji,
    count: tally.count,
    mine: tally.userIds.includes(me),
  }));

/** Resultado de um comunicado: cada emoji com quem o escolheu; ordenado por votos. */
export const tallyReactions = (rows: Omit<NoticeReactionRow, 'notification_id'>[]) => {
  const byEmoji = new Map<string, string[]>();
  rows.forEach(row => byEmoji.set(row.emoji, [...(byEmoji.get(row.emoji) ?? []), row.user_id]));
  const top = Math.max(0, ...[...byEmoji.values()].map(ids => ids.length));
  return [...byEmoji.entries()]
    .map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds, leading: false }))
    .sort((a, b) => b.count - a.count)
    .map<ReactionTally>(tally => ({ ...tally, leading: top > 0 && tally.count === top }));
};

/**
 * A minha reação depois de carregar num emoji: o mesmo outra vez retira-a; outro troca-a.
 * Devolve a lista nova e o emoji que fica (null = sem reação).
 */
export const applyReaction = (
  rows: NoticeReactionRow[],
  noticeId: string,
  me: string,
  emoji: string
): { rows: NoticeReactionRow[]; emoji: string | null } => {
  const mine = rows.find(row => row.notification_id === noticeId && row.user_id === me);
  const others = rows.filter(row => row !== mine);
  if (mine?.emoji === emoji) return { rows: others, emoji: null };
  return { rows: [...others, { notification_id: noticeId, user_id: me, emoji }], emoji };
};
