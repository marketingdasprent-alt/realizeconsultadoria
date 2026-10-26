// Conversão das linhas da BD para os tipos da interface do Messenger.
import type {
  ConversationRow,
  DirectoryRow,
  MemberRow,
  MessageRow,
  ReactionRow,
} from '../services/messengerService';
import { messengerService } from '../services/messengerService';
import type {
  ChatMessage,
  ConversationKind,
  ConversationSummary,
  DirectoryPerson,
  MessageKind,
  MessageReaction,
} from '../types';

export const FORMER_COLLEAGUE = 'Antigo colaborador';

export const toPerson = (row: DirectoryRow): DirectoryPerson => ({
  userId: row.user_id,
  employeeId: row.employee_id,
  name: row.name,
  position: row.position,
  department: row.department,
  email: row.email,
  phone: row.phone ?? null,
});

const lastMessageText = (row: ConversationRow): string => {
  if (!row.last_kind) return 'Sem mensagens';
  if (row.last_deleted) return 'Mensagem eliminada';
  if (row.last_kind === 'audio') return '🎤 Mensagem de voz';
  if (row.last_kind === 'image') return `📷 ${row.last_body || 'Fotografia'}`;
  if (row.last_kind === 'file') return `📎 ${row.last_attachment_name ?? 'Ficheiro'}`;
  return row.last_body ?? '';
};

export const toConversation = (
  row: ConversationRow,
  myUserId: string,
  online: Set<string>
): ConversationSummary => {
  const kind = row.kind as ConversationKind;
  const isDirect = kind === 'direct';
  const fromMe = row.last_sender_id === myUserId;
  return {
    id: row.id,
    kind,
    title: isDirect ? (row.peer_name ?? FORMER_COLLEAGUE) : (row.title ?? 'Conversa'),
    subtitle: isDirect
      ? ([row.peer_position, row.peer_department].filter(Boolean).join(' · ') ?? undefined)
      : `${row.member_count} ${row.member_count === 1 ? 'membro' : 'membros'}`,
    lastMessage: lastMessageText(row),
    lastAuthor:
      row.last_kind &&
      (fromMe ? 'Eu' : !isDirect ? row.last_sender_name?.split(' ')[0] : undefined),
    lastAt: row.last_message_at ?? row.created_at,
    unread: row.unread,
    pinned: row.is_pinned,
    muted: row.is_muted,
    archived: row.is_archived,
    online: isDirect && !!row.peer_user_id && online.has(row.peer_user_id),
    peerUserId: row.peer_user_id ?? undefined,
    memberCount: row.member_count,
    avatarUrl: row.avatar_path ? messengerService.groupAvatarUrl(row.avatar_path) : undefined,
    canPost: kind !== 'announcement' || row.my_role === 'owner' || row.my_role === 'admin',
  };
};

const groupReactions = (rows: ReactionRow[], myUserId: string): MessageReaction[] => {
  const byEmoji = new Map<string, MessageReaction>();
  for (const row of rows) {
    const current = byEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    current.count += 1;
    current.mine = current.mine || row.user_id === myUserId;
    byEmoji.set(row.emoji, current);
  }
  return [...byEmoji.values()];
};

interface MessageContext {
  myUserId: string;
  names: Map<string, string>;
  reactions: ReactionRow[];
  members: MemberRow[];
  byId: Map<string, MessageRow>;
  isDirect: boolean;
}

const authorOf = (senderId: string | null, ctx: MessageContext): string =>
  senderId === ctx.myUserId ? 'Eu' : ((senderId && ctx.names.get(senderId)) ?? FORMER_COLLEAGUE);

export const toMessage = (row: MessageRow, ctx: MessageContext): ChatMessage => {
  const reply = row.reply_to_id ? ctx.byId.get(row.reply_to_id) : undefined;
  const isMine = row.sender_id === ctx.myUserId;
  const peer = ctx.members.find(member => member.user_id !== ctx.myUserId);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    authorName: authorOf(row.sender_id, ctx),
    isMine,
    kind: row.kind as MessageKind,
    text: row.body ?? undefined,
    attachment: row.attachment_path
      ? {
          path: row.attachment_path,
          name: row.attachment_name ?? 'ficheiro',
          size: row.attachment_size ?? 0,
          mime: row.attachment_mime ?? '',
        }
      : undefined,
    durationSec: row.duration_sec ?? undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    deleted: !!row.deleted_at,
    replyTo: reply
      ? {
          id: reply.id,
          authorName: authorOf(reply.sender_id, ctx),
          text: reply.deleted_at
            ? 'Mensagem eliminada'
            : (reply.body ?? reply.attachment_name ?? 'Anexo'),
        }
      : undefined,
    reactions: groupReactions(
      ctx.reactions.filter(reaction => reaction.message_id === row.id),
      ctx.myUserId
    ),
    read: isMine && ctx.isDirect && !!peer && peer.last_read_at >= row.created_at,
  };
};
