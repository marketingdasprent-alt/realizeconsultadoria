import React from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMOJI_GROUPS } from '../lib/emojis';

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
  triggerClassName: string;
}

/** Seletor de emojis da caixa de escrita. */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onPick, disabled, triggerClassName }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" className={triggerClassName} disabled={disabled} aria-label="Emoji">
        <Smile className="h-5 w-5" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="start"
      sideOffset={10}
      className="rz-scroll max-h-72 w-72 overflow-y-auto rounded-3xl p-3 shadow-rz-pop"
    >
      {EMOJI_GROUPS.map(group => (
        <div key={group.label} className="mb-2 last:mb-0">
          <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-rz-muted">
            {group.label}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-rz-canvas"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </PopoverContent>
  </Popover>
);
