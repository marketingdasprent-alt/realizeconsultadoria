import React from 'react';
import { richTextParts } from '../lib/richText';

interface RichTextProps {
  text: string;
  onHashtag?: (tag: string) => void;
  className?: string;
}

/** Texto com quebras de linha, ligações clicáveis e #hashtags clicáveis. */
export const RichText: React.FC<RichTextProps> = ({ text, onHashtag, className }) => (
  <p className={className ?? 'whitespace-pre-wrap break-words text-[15px] leading-relaxed'}>
    {richTextParts(text).map((part, index) => {
      if (part.kind === 'link')
        return (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={event => event.stopPropagation()}
            className="break-all font-semibold text-rz-primary underline decoration-rz-primary/40 underline-offset-2 hover:decoration-rz-primary"
          >
            {part.value}
          </a>
        );
      if (part.kind === 'hashtag' && onHashtag)
        return (
          <button
            key={index}
            type="button"
            onClick={() => onHashtag(part.tag)}
            className="font-semibold text-rz-primary hover:underline"
          >
            {part.value}
          </button>
        );
      return <React.Fragment key={index}>{part.value}</React.Fragment>;
    })}
  </p>
);
