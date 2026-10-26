import React from 'react';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { FILTERS } from '../lib/format';
import type { ConversationSummary } from '../types';

interface ConversationAvatarProps {
  conversation: Pick<ConversationSummary, 'kind' | 'title' | 'online' | 'peerUserId' | 'avatarUrl'>;
  size?: 'sm' | 'md' | 'lg';
}

/** Pessoa → iniciais com estado; grupos, canais, anúncios e IA → mosaico do tipo. */
export const ConversationAvatar: React.FC<ConversationAvatarProps> = ({
  conversation,
  size = 'md',
}) => {
  if (conversation.kind === 'direct') {
    return (
      <UserAvatar
        name={conversation.title}
        userId={conversation.peerUserId}
        size={size === 'lg' ? 'md' : size}
        status={conversation.online ? 'online' : undefined}
      />
    );
  }
  if (conversation.avatarUrl) {
    return (
      <img
        src={conversation.avatarUrl}
        alt=""
        className={
          size === 'lg'
            ? 'h-20 w-20 shrink-0 rounded-[24px] object-cover'
            : size === 'md'
              ? 'h-11 w-11 shrink-0 rounded-2xl object-cover'
              : 'h-9 w-9 shrink-0 rounded-xl object-cover'
        }
      />
    );
  }
  const filter = FILTERS.find(option => option.key === conversation.kind) ?? FILTERS[0];
  return (
    <ModuleIcon
      module={filter}
      size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
      className={
        size === 'lg'
          ? 'h-20 w-20 rounded-[24px]'
          : size === 'md'
            ? 'h-11 w-11 rounded-2xl'
            : undefined
      }
    />
  );
};
