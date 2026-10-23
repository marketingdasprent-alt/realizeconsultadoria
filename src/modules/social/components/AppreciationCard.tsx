import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { APPRECIATION_TYPES } from '@/modules/workspace/lib/appreciations';
import type { Appreciation } from '../types';
import { AppreciationReactions } from './AppreciationReactions';

interface AppreciationCardProps {
  appreciation: Appreciation;
  /** No Feed: cartão maior, com fundo festivo. */
  variant?: 'feed' | 'list';
  /** Sem isto não mostra emojis. */
  onReact?: (appreciation: Appreciation, emoji: string) => void;
}

/** "Ana reconheceu Joana — Ajuda importante", com a mensagem opcional. */
export const AppreciationCard: React.FC<AppreciationCardProps> = ({
  appreciation,
  variant = 'list',
  onReact,
}) => {
  const { basePath, user } = useWorkspace();
  const type = APPRECIATION_TYPES.find(t => t.key === appreciation.kind) ?? APPRECIATION_TYPES[0];
  const person = (id: string | null, name: string) =>
    id && id !== user.userId ? (
      <Link to={`${basePath}/pessoas/${id}`} className="font-bold hover:text-rz-primary">
        {name}
      </Link>
    ) : (
      <span className="font-bold">{name}</span>
    );

  return (
    <article
      className={cn(
        'rz-rise flex gap-4 rounded-[28px] p-5 ring-1',
        variant === 'feed'
          ? 'bg-gradient-to-br from-violet-50 via-white to-pink-50 shadow-rz-soft ring-violet-100'
          : 'bg-white ring-rz-line'
      )}
    >
      <ModuleIcon module={type} size={variant === 'feed' ? 'lg' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug">
          {appreciation.senderId === user.userId ? (
            <>
              Reconheceu o trabalho de{' '}
              {person(appreciation.recipientId, appreciation.recipientName)}
            </>
          ) : appreciation.recipientId === user.userId ? (
            <>{person(appreciation.senderId, appreciation.senderName)} reconheceu o seu trabalho</>
          ) : (
            <>
              {person(appreciation.senderId, appreciation.senderName)} reconheceu{' '}
              {person(appreciation.recipientId, appreciation.recipientName)}
            </>
          )}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-rz-primary">{type.label}</p>
        {appreciation.message && (
          <p className="mt-2 rounded-2xl bg-white/80 px-3.5 py-2 text-[14px] italic text-rz-ink/90 ring-1 ring-rz-line">
            “{appreciation.message}”
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-rz-muted">
          {formatDistanceToNowStrict(new Date(appreciation.createdAt), {
            locale: pt,
            addSuffix: true,
          })}
          {!appreciation.isPublic && (
            <span className="inline-flex items-center gap-1">
              · <Lock className="h-3 w-3" /> Privada
            </span>
          )}
        </p>
        {onReact && (
          <AppreciationReactions
            reactors={appreciation.reactors ?? []}
            onReact={emoji => onReact(appreciation, emoji)}
          />
        )}
      </div>
    </article>
  );
};
