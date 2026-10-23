import React, { useRef, useState } from 'react';
import { EmojiSuggestions } from '@/modules/workspace/components/EmojiSuggestions';
import { useEmojiAutocomplete } from '@/modules/workspace/hooks/useEmojiAutocomplete';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Loader2, SendHorizontal, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useFeedComments } from '../../hooks/useFeedComments';

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

  const submit = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    if (await add(text)) setText('');
    setIsSending(false);
  };

  return (
    <div className="mt-3 space-y-3 border-t border-rz-line pt-3">
      {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />}
      {comments.map(comment => (
        <div key={comment.id} className="group flex gap-2.5">
          <UserAvatar name={comment.authorName} userId={comment.authorId} size="xs" />
          <div className="min-w-0 flex-1">
            <div className="inline-block max-w-full rounded-2xl bg-rz-canvas px-3.5 py-2">
              <p className="text-[13px] font-bold">{comment.authorName}</p>
              <p className="whitespace-pre-wrap break-words text-[14px]">{comment.body}</p>
            </div>
            <div className="ml-2 mt-0.5 flex items-center gap-3 text-[11.5px] text-rz-muted">
              <span>{formatDistanceToNowStrict(new Date(comment.createdAt), { locale: pt })}</span>
              {comment.isMine && (
                <button
                  type="button"
                  onClick={() => remove(comment.id)}
                  className="inline-flex items-center gap-1 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" /> Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="relative flex items-center gap-2.5">
        <UserAvatar name={user.name} userId={user.userId} size="xs" />
        <EmojiSuggestions
          suggestions={emoji.suggestions}
          active={emoji.active}
          onPick={emoji.pick}
          onHover={emoji.setActive}
          className="left-9"
        />
        <div className="flex flex-1 items-center rounded-full bg-rz-canvas pr-1 ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
          <input
            ref={inputRef}
            value={text}
            onChange={event => {
              setText(event.target.value.slice(0, 2000));
              emoji.update(event.target.value);
            }}
            onSelect={() => emoji.update()}
            onBlur={emoji.close}
            onKeyDown={event => {
              if (emoji.onKeyDown(event)) return;
              if (event.key === 'Enter') submit();
            }}
            placeholder="Escreva um comentário…"
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
