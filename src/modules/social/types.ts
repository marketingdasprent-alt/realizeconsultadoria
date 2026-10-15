// Tipos do Feed (§12), das Apreciações (§7) e dos comunicados dos RH no Feed.

export interface FeedAttachment {
  /** Caminho no bucket privado feed-files ("<publicação>/<ficheiro>"), ou URL local no exemplo. */
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface FeedReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface FeedPost {
  id: string;
  authorId: string | null;
  authorName: string;
  authorRole: string | null;
  isMine: boolean;
  body: string | null;
  audience: 'company' | 'department';
  department: string | null;
  attachments: FeedAttachment[];
  createdAt: string;
  editedAt: string | null;
  commentCount: number;
  reactions: FeedReaction[];
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  isMine: boolean;
  body: string;
  createdAt: string;
}

/** Aviso dos RH (tabela notifications), mostrado no Feed como comunicado. */
export interface Notice {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export type AppreciationKind =
  | 'great_work'
  | 'team_spirit'
  | 'creativity'
  | 'leadership'
  | 'helpful'
  | 'professional'
  | 'innovation'
  | 'dedication'
  | 'congrats'
  | 'thanks';

export interface Appreciation {
  id: string;
  kind: AppreciationKind;
  senderId: string | null;
  senderName: string;
  recipientId: string;
  recipientName: string;
  message: string | null;
  isPublic: boolean;
  createdAt: string;
}

export interface NewPostInput {
  body: string;
  audience: 'company' | 'department';
  files: File[];
}

export interface NewAppreciationInput {
  recipientId: string;
  kind: AppreciationKind;
  message: string;
  isPublic: boolean;
}
