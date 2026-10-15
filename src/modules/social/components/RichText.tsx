import React from 'react';

interface RichTextProps {
  text: string;
  onHashtag?: (tag: string) => void;
  className?: string;
}

const PARTS = /(#[\p{L}\p{N}_]{2,40})/gu;

/** Texto com quebras de linha e #hashtags clicáveis. */
export const RichText: React.FC<RichTextProps> = ({ text, onHashtag, className }) => (
  <p className={className ?? 'whitespace-pre-wrap break-words text-[15px] leading-relaxed'}>
    {text.split(PARTS).map((part, index) =>
      part.startsWith('#') && part.length > 2 ? (
        <button
          key={index}
          type="button"
          onClick={() => onHashtag?.(part.slice(1).toLowerCase())}
          className="font-semibold text-rz-primary hover:underline"
        >
          {part}
        </button>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    )}
  </p>
);
