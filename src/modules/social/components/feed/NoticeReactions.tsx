import React from 'react';
import { cn } from '@/lib/utils';
import { EmojiPicker } from '@/modules/messenger/components/EmojiPicker';
import type { NoticeReaction } from '../../lib/noticeReactions';

interface NoticeReactionsProps {
  reactions: NoticeReaction[];
  onReact: (emoji: string) => void;
}

/**
 * Reações a um comunicado. Uma por pessoa: carregar noutro emoji troca o voto, no mesmo
 * retira-o. Dá para votações ("🎃 equipa A, 👻 equipa B").
 */
export const NoticeReactions: React.FC<NoticeReactionsProps> = ({ reactions, onReact }) => (
  <div className="mt-4 flex flex-wrap items-center gap-1.5">
    {reactions.map(reaction => (
      <button
        key={reaction.emoji}
        type="button"
        onClick={() => onReact(reaction.emoji)}
        title={reaction.mine ? 'A sua reação (carregue para retirar)' : 'Reagir com este'}
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
    <EmojiPicker
      onPick={onReact}
      triggerClassName="flex h-8 w-8 items-center justify-center rounded-full bg-white text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas hover:text-rz-primary"
    />
  </div>
);
