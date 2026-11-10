import React from 'react';
import { Link } from 'react-router-dom';
import { mentionParts, type MentionPerson } from '@/modules/messenger/lib/mentions';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { richTextParts } from '../lib/richText';

interface RichTextProps {
  text: string;
  onHashtag?: (tag: string) => void;
  /** Pessoas marcadas: o "@Nome" aparece destacado e abre o perfil. */
  mentions?: MentionPerson[];
  className?: string;
}

/** Texto simples com os "@Nome" das pessoas marcadas como ligação para o perfil. */
const WithMentions: React.FC<{ text: string; mentions: MentionPerson[] }> = ({
  text,
  mentions,
}) => {
  const { basePath } = useWorkspace();
  if (!mentions.length) return <>{text}</>;
  const byName = new Map(mentions.map(person => [`@${person.name}`, person.userId]));
  return (
    <>
      {mentionParts(
        text,
        mentions.map(person => person.name)
      ).map((part, index) => {
        const userId = part.mention ? byName.get(part.text) : undefined;
        return userId ? (
          <Link
            key={index}
            to={`${basePath}/pessoas/${userId}`}
            onClick={event => event.stopPropagation()}
            className="rounded-md bg-rz-primary-soft px-1 font-semibold text-rz-primary hover:underline"
          >
            {part.text}
          </Link>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        );
      })}
    </>
  );
};

/** Texto com quebras de linha, ligações clicáveis, #hashtags e @pessoas marcadas. */
export const RichText: React.FC<RichTextProps> = ({ text, onHashtag, mentions, className }) => (
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
      return <WithMentions key={index} text={part.value} mentions={mentions ?? []} />;
    })}
  </p>
);
