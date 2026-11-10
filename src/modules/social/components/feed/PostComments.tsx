import React, { useRef, useState } from 'react';
import { EmojiSuggestions } from '@/modules/workspace/components/EmojiSuggestions';
import { useEmojiAutocomplete } from '@/modules/workspace/hooks/useEmojiAutocomplete';
import { Loader2, SendHorizontal, X } from 'lucide-react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useFeedComments } from '../../hooks/useFeedComments';
import { useDirectory } from '../../hooks/useDirectory';
import { MentionSuggestions } from '@/modules/messenger/components/composer/MentionSuggestions';
import { useMentions } from '@/modules/messenger/hooks/useMentions';
import type { FeedComment } from '../../types';
import { CommentItem } from './CommentItem';

/** Comentários de uma publicação e caixa para comentar. */
export const PostComments: React.FC<{ postId: string }> = ({ postId }) => {
  const { user } = useWorkspace();
  const { comments, isLoading, add, remove } = useFeedComments(postId, true);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // ':so' → lista de emojis, como no WhatsApp.
  const emoji = useEmojiAutocomplete({
    value: text,
    onChange: value => setText(value.slice(0, 2000)),
    fieldRef: inputRef,
  });
  const [isSending, setIsSending] = useState(false);
  // A responder a um comentário (a resposta fica por baixo do comentário principal)
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const top = comments.filter(c => !c.parentId || !comments.some(p => p.id === c.parentId));
  const repliesOf = (id: string) => comments.filter(c => c.parentId === id);
  const reply = (comment: FeedComment) => {
    setReplyTo(comment);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const { colleagues } = useDirectory();
  const mention = useMentions({
    value: text,
    onChange: value => setText(value.slice(0, 2000)),
    fieldRef: inputRef,
    people: colleagues.map(person => ({ userId: person.userId, name: person.name })),
  });

  const submit = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    const parentId = replyTo ? (replyTo.parentId ?? replyTo.id) : null;
    if (await add(text, mention.mentionedIn(text), parentId)) {
      mention.reset();
      setText('');
      setReplyTo(null);
    }
    setIsSending(false);
  };

  return (
    <div className="mt-3 space-y-3 border-t border-rz-line pt-3">
      {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />}
      {top.map(comment => (
        <div key={comment.id} className="space-y-2">
          <CommentItem comment={comment} onReply={reply} onRemove={remove} />
          {repliesOf(comment.id).map(child => (
            <CommentItem key={child.id} comment={child} onReply={reply} onRemove={remove} isReply />
          ))}
        </div>
      ))}
      {replyTo && (
        <p className="ml-9 flex items-center gap-2 text-[12px] text-rz-muted">
          A responder a <b className="text-rz-ink">{replyTo.authorName}</b>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-rz-canvas"
            aria-label="Cancelar resposta"
          >
            <X className="h-3 w-3" />
          </button>
        </p>
      )}
      <div className="relative flex items-center gap-2.5">
        <UserAvatar name={user.name} userId={user.userId} size="xs" />
        <EmojiSuggestions
          suggestions={emoji.suggestions}
          active={emoji.active}
          onPick={emoji.pick}
          onHover={emoji.setActive}
          className="left-9"
        />
        {/* Por cima: por baixo ficava tapada pela publicação seguinte */}
        <MentionSuggestions
          suggestions={mention.suggestions}
          active={mention.active}
          onPick={mention.pick}
          onHover={mention.setActive}
          className="bottom-full left-7 mb-2"
        />
        <div className="flex flex-1 items-center rounded-full bg-rz-canvas pr-1 ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
          <input
            ref={inputRef}
            value={text}
            onChange={event => {
              setText(event.target.value.slice(0, 2000));
              emoji.update(event.target.value);
              mention.update(event.target.value);
            }}
            onSelect={() => {
              emoji.update();
              mention.update();
            }}
            onBlur={() => {
              emoji.close();
              mention.close();
            }}
            onKeyDown={event => {
              if (mention.onKeyDown(event)) return;
              if (emoji.onKeyDown(event)) return;
              if (event.key === 'Escape' && replyTo) setReplyTo(null);
              if (event.key === 'Enter') submit();
            }}
            placeholder={
              replyTo
                ? `Responder a ${replyTo.authorName.split(' ')[0]}…`
                : 'Escreva um comentário… (@ para marcar)'
            }
            className="h-10 flex-1 bg-transparent px-4 text-sm outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || isSending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-rz-primary text-white disabled:opacity-30"
            aria-label="Comentar"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
