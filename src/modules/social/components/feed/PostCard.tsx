import React, { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Building2, MessageCircle, MoreHorizontal, SmilePlus, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { FEED_REACTIONS } from '../../lib/feed';
import type { FeedPost } from '../../types';
import { RichText } from '../RichText';
import { PostAttachments } from './PostAttachments';
import { PostComments } from './PostComments';

interface PostCardProps {
  post: FeedPost;
  onReact: (post: FeedPost, emoji: string) => void;
  onDelete: (post: FeedPost) => void;
  onHashtag: (tag: string) => void;
  /** Aberta a partir de uma notificação: destacada e com os comentários abertos. */
  isFocused?: boolean;
}

/** Publicação: autor, público, texto, anexos, reações e comentários. */
export const PostCard: React.FC<PostCardProps> = ({
  post,
  onReact,
  onDelete,
  onHashtag,
  isFocused,
}) => {
  const [showComments, setShowComments] = useState(!!isFocused);
  const AudienceIcon = post.audience === 'department' ? Users : Building2;

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        'rz-rise rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line',
        isFocused && 'ring-2 ring-rz-primary/50'
      )}
    >
      <header className="flex items-start gap-3">
        <UserAvatar name={post.authorName} userId={post.authorId} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{post.authorName}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-rz-muted">
            {post.authorRole && <span className="truncate">{post.authorRole}</span>}
            <span>
              {formatDistanceToNowStrict(new Date(post.createdAt), { locale: pt, addSuffix: true })}
            </span>
            <span className="inline-flex items-center gap-1">
              <AudienceIcon className="h-3 w-3" />
              {post.audience === 'department' ? post.department : 'Toda a empresa'}
            </span>
          </p>
        </div>
        {post.isMine && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas"
                aria-label="Opções da publicação"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl p-1.5">
              <DropdownMenuItem
                className="rounded-xl text-rose-600 focus:text-rose-600"
                onClick={() => onDelete(post)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar publicação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.body && (
        <RichText
          text={post.body}
          onHashtag={onHashtag}
          className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed"
        />
      )}
      <PostAttachments attachments={post.attachments} />

      <footer className="mt-4 flex flex-wrap items-center gap-1.5">
        {post.reactions.map(reaction => (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onReact(post, reaction.emoji)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[13px] font-semibold ring-1 transition-colors',
              reaction.mine
                ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary/30'
                : 'bg-white ring-rz-line hover:bg-rz-canvas'
            )}
          >
            {reaction.emoji} {reaction.count}
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas hover:text-rz-primary"
              aria-label="Reagir"
            >
              <SmilePlus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="flex w-auto gap-1 rounded-full p-1.5 shadow-rz-pop">
            {FEED_REACTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(post, emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => setShowComments(open => !open)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount > 0
            ? `${post.commentCount} comentário${post.commentCount > 1 ? 's' : ''}`
            : 'Comentar'}
        </button>
      </footer>

      {showComments && <PostComments postId={post.id} />}
    </article>
  );
};
