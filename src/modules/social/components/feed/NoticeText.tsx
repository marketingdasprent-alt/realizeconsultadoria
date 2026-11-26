import React from 'react';
import { cn } from '@/lib/utils';
import {
  parseBlocks,
  type InlinePart,
} from '../../../../../supabase/functions/_shared/broadcast-format';
import { richTextParts } from '../../lib/richText';

/** Um pedaço de linha: ligações clicáveis e, se for o caso, negrito/itálico. */
const Inline: React.FC<{ parts: InlinePart[] }> = ({ parts }) => (
  <>
    {parts.map((part, index) => {
      const content = richTextParts(part.text).map((piece, at) =>
        piece.kind === 'link' ? (
          <a
            key={at}
            href={piece.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={event => event.stopPropagation()}
            className="break-all font-semibold text-rz-primary underline decoration-rz-primary/40 underline-offset-2 hover:decoration-rz-primary"
          >
            {piece.value}
          </a>
        ) : (
          <React.Fragment key={at}>{piece.value}</React.Fragment>
        )
      );
      const styled = part.italic ? <em>{content}</em> : <>{content}</>;
      return part.bold ? (
        <strong key={index} className="font-bold text-rz-ink">
          {styled}
        </strong>
      ) : (
        <React.Fragment key={index}>{styled}</React.Fragment>
      );
    })}
  </>
);

/**
 * Texto de um comunicado no Feed, com a mesma formatação do email: parágrafos, **negrito**,
 * _itálico_, listas com pontos e numeradas, e ligações.
 */
export const NoticeText: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div
    className={cn('space-y-3 break-words text-[15px] leading-relaxed text-rz-ink/90', className)}
  >
    {parseBlocks(text).map((block, index) => {
      if (block.kind === 'paragraph')
        return (
          <p key={index}>
            {block.lines.map((line, at) => (
              <React.Fragment key={at}>
                {at > 0 && <br />}
                <Inline parts={line} />
              </React.Fragment>
            ))}
          </p>
        );
      const List = block.kind === 'bullets' ? 'ul' : 'ol';
      return (
        <List
          key={index}
          className={cn('space-y-1 pl-5', block.kind === 'bullets' ? 'list-disc' : 'list-decimal')}
        >
          {block.items.map((item, at) => (
            <li key={at}>
              <Inline parts={item} />
            </li>
          ))}
        </List>
      );
    })}
  </div>
);
