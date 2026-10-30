import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MessageReaction } from '../types';

interface ReactionChipsProps {
  reactions: MessageReaction[];
  mine: boolean;
  onReact: (emoji: string) => void;
}

/**
 * Reações por baixo da mensagem. Carregar abre quem reagiu (e deixa pôr ou tirar a minha);
 * no computador o nome também aparece ao passar o rato.
 */
export const ReactionChips: React.FC<ReactionChipsProps> = ({ reactions, mine, onReact }) => (
  <div className={cn('-mt-1.5 flex flex-wrap gap-1', mine ? 'mr-3' : 'ml-3')}>
    {reactions.map(reaction => (
      <Popover key={reaction.emoji}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={reaction.names.join(', ')}
            className={cn(
              'rounded-full bg-white px-2 py-0.5 text-xs shadow-sm ring-1 transition-colors hover:bg-rz-canvas',
              reaction.mine ? 'ring-rz-primary/50' : 'ring-rz-line'
            )}
          >
            {reaction.emoji} {reaction.count > 1 && reaction.count}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={mine ? 'end' : 'start'}
          className="w-60 rounded-2xl p-2 font-jakarta shadow-rz-pop"
        >
          <p className="flex items-center gap-2 px-2 pb-1.5 pt-1 text-[12px] font-bold text-rz-muted">
            <span className="text-[18px] leading-none">{reaction.emoji}</span>
            {reaction.count} {reaction.count === 1 ? 'reação' : 'reações'}
          </p>
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {reaction.names.map((name, index) => (
              <li
                key={`${name}-${index}`}
                className="truncate px-2 py-1 text-[13.5px] font-semibold"
              >
                {name}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onReact(reaction.emoji)}
            className="mt-1.5 w-full rounded-xl bg-rz-canvas px-3 py-1.5 text-[12.5px] font-semibold text-rz-primary hover:bg-rz-primary-soft"
          >
            {reaction.mine ? 'Retirar a minha reação' : `Reagir também ${reaction.emoji}`}
          </button>
        </PopoverContent>
      </Popover>
    ))}
  </div>
);
