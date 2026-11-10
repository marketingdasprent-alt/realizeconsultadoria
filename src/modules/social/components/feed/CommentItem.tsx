import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { FeedComment } from '../../types';
import { RichText } from '../RichText';

interface CommentItemProps {
  comment: FeedComment;
  onReply: (comment: FeedComment) => void;
  onRemove: (id: string) => void;
  /** Resposta: mais pequena e encostada à direita do comentário principal. */
  isReply?: boolean;
}

/** Um comentário do Feed: autor, texto, há quanto tempo, Responder e (meu) Eliminar. */
export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onRemove,
  isReply = false,
}) => (
  <div className={cn('group flex gap-2.5', isReply && 'ml-9')}>
    <UserAvatar name={comment.authorName} userId={comment.authorId} size="xs" />
    <div className="min-w-0 flex-1">
      <div className="inline-block max-w-full rounded-2xl bg-rz-canvas px-3.5 py-2">
        <p className="text-[13px] font-bold">{comment.authorName}</p>
        <RichText
          text={comment.body}
          mentions={comment.mentions}
          className="whitespace-pre-wrap break-words text-[14px]"
        />
      </div>
      <div className="ml-2 mt-0.5 flex items-center gap-3 text-[11.5px] text-rz-muted">
        <span>{formatDistanceToNowStrict(new Date(comment.createdAt), { locale: pt })}</span>
        <button
          type="button"
          onClick={() => onReply(comment)}
          className="font-semibold hover:text-rz-primary"
        >
          Responder
        </button>
        {comment.isMine && (
          <button
            type="button"
            onClick={() => onRemove(comment.id)}
            className="inline-flex items-center gap-1 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" /> Eliminar
          </button>
        )}
      </div>
    </div>
  </div>
);
