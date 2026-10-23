import React from 'react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { FEED_REACTIONS, groupReactors } from '../lib/feed';
import { ReactorsPopover } from './feed/PostReactors';

interface AppreciationReactionsProps {
  reactors: { user_id: string; emoji: string }[];
  onReact: (emoji: string) => void;
}

/** Emojis num reconhecimento, como nas publicações: contar, pôr/tirar e ver quem reagiu. */
export const AppreciationReactions: React.FC<AppreciationReactionsProps> = ({
  reactors,
  onReact,
}) => {
  const { user } = useWorkspace();
  const groups = groupReactors(reactors);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {groups.map(group => {
        const mine = group.userIds.includes(user.userId);
        return (
          <button
            key={group.emoji}
            type="button"
            onClick={() => onReact(group.emoji)}
            aria-pressed={mine}
            className={cn(
              'rounded-full px-2.5 py-1 text-[13px] font-semibold ring-1 transition-colors',
              mine
                ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary/30'
                : 'bg-white ring-rz-line hover:bg-rz-canvas'
            )}
          >
            {group.emoji} {group.userIds.length}
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas hover:text-rz-primary"
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
              onClick={() => onReact(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {reactors.length > 0 && <ReactorsPopover rows={reactors} />}
    </div>
  );
};
