// Linha do tempo do Feed: publicações, comunicados dos RH e reconhecimentos públicos.
import type { Appreciation, FeedPost, Notice } from '../types';
import { extractHashtags } from './feed';

export type FeedFilter = 'all' | 'notices' | 'posts' | 'recognitions';

export type TimelineItem =
  | { type: 'post'; at: string; post: FeedPost }
  | { type: 'notice'; at: string; notice: Notice }
  | { type: 'recognition'; at: string; appreciation: Appreciation };

export const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'notices', label: 'Comunicados' },
  { key: 'posts', label: 'Publicações' },
  { key: 'recognitions', label: 'Reconhecimentos' },
];

interface BuildInput {
  posts: FeedPost[];
  notices: Notice[];
  recognitions: Appreciation[];
  filter: FeedFilter;
  query: string;
  hashtag: string | null;
}

/** Comunicados por confirmar primeiro; o resto por data, do mais recente. */
export const buildTimeline = ({
  posts,
  notices,
  recognitions,
  filter,
  query,
  hashtag,
}: BuildInput) => {
  const term = query.trim().toLowerCase();
  const matches = (...texts: (string | null | undefined)[]) =>
    !term || texts.some(text => text?.toLowerCase().includes(term));

  const items: TimelineItem[] = [];
  if (filter === 'all' || filter === 'posts') {
    for (const post of posts) {
      if (hashtag && !extractHashtags(post.body).includes(hashtag)) continue;
      if (matches(post.body, post.authorName))
        items.push({ type: 'post', at: post.createdAt, post });
    }
  }
  if (!hashtag && (filter === 'all' || filter === 'notices')) {
    for (const notice of notices) {
      if (matches(notice.title, notice.message))
        items.push({ type: 'notice', at: notice.createdAt, notice });
    }
  }
  if (!hashtag && (filter === 'all' || filter === 'recognitions')) {
    for (const appreciation of recognitions) {
      if (matches(appreciation.message, appreciation.senderName, appreciation.recipientName)) {
        items.push({ type: 'recognition', at: appreciation.createdAt, appreciation });
      }
    }
  }
  const pending = (item: TimelineItem) => item.type === 'notice' && !item.notice.read;
  return items.sort((a, b) => Number(pending(b)) - Number(pending(a)) || b.at.localeCompare(a.at));
};

/** Hashtags mais usadas nas publicações carregadas. */
export const topHashtags = (posts: FeedPost[]): [string, number][] => {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of new Set(extractHashtags(post.body)))
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};
