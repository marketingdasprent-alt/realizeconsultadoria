// Regras e conversões do Feed.
import type { DirectoryPerson } from '@/modules/messenger/types';
import type { FeedPostRow } from '../services/feedService';
import type { FeedAttachment, FeedPost, FeedReaction } from '../types';

export const FEED_KEYS = {
  posts: ['feed', 'posts'] as const,
  comments: (postId: string) => ['feed', 'comments', postId] as const,
  notices: ['feed', 'notices'] as const,
  appreciations: ['appreciations'] as const,
};

export const MAX_POST_FILES = 4;
export const MAX_POST_FILE_BYTES = 15 * 1024 * 1024;
export const POST_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export const FEED_REACTIONS = ['👍', '❤️', '🎉', '👏', '😂', '😮'];

/** Problema com os ficheiros escolhidos, ou null. */
export const validatePostFiles = (files: File[]): string | null => {
  if (files.length > MAX_POST_FILES) return `No máximo ${MAX_POST_FILES} ficheiros por publicação.`;
  if (files.some(file => file.size > MAX_POST_FILE_BYTES))
    return 'Cada ficheiro pode ter até 15 MB.';
  if (files.some(file => !POST_FILE_TYPES.includes(file.type))) {
    return 'Só imagens, PDF e documentos do Office.';
  }
  return null;
};

/** Hashtags de um texto (#equipa → "equipa"). */
export const extractHashtags = (text: string | null): string[] =>
  [...(text ?? '').matchAll(/#([\p{L}\p{N}_]{2,40})/gu)].map(match => match[1].toLowerCase());

const roleOf = (person: DirectoryPerson | undefined): string | null =>
  person ? [person.position, person.department].filter(Boolean).join(' · ') || null : null;

export const toPost = (
  row: FeedPostRow,
  myUserId: string,
  nameOf: (id: string | null) => string,
  byId: Map<string, DirectoryPerson>
): FeedPost => ({
  id: row.id,
  authorId: row.author_id,
  authorName: nameOf(row.author_id),
  authorRole: row.author_id ? roleOf(byId.get(row.author_id)) : null,
  isMine: row.author_id === myUserId,
  body: row.body,
  audience: row.audience === 'department' ? 'department' : 'company',
  department: row.department,
  attachments: Array.isArray(row.attachments)
    ? (row.attachments as unknown as FeedAttachment[])
    : [],
  createdAt: row.created_at,
  editedAt: row.edited_at,
  commentCount: row.comment_count,
  reactions: Array.isArray(row.reactions) ? (row.reactions as unknown as FeedReaction[]) : [],
});

/** Junta/retira a minha reação (para a pré-visualização e atualizações otimistas). */
export const toggleReactionIn = (reactions: FeedReaction[], emoji: string): FeedReaction[] => {
  const existing = reactions.find(r => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, mine: true }];
  return reactions
    .map(r => (r.emoji === emoji ? { ...r, count: r.count + (r.mine ? -1 : 1), mine: !r.mine } : r))
    .filter(r => r.count > 0);
};
