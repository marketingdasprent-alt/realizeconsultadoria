import React from 'react';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { FILTERS } from '../lib/format';
import type { ConversationSummary } from '../types';

interface ConversationAvatarProps {
  conversation: Pick<ConversationSummary, 'kind' | 'title' | 'online' | 'peerUserId'>;
  size?: 'sm' | 'md';
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
        size={size}
        status={conversation.online ? 'online' : undefined}
      />
    );
  }
  const filter = FILTERS.find(option => option.key === conversation.kind) ?? FILTERS[0];
  return (
    <ModuleIcon
      module={filter}
      size={size === 'md' ? 'md' : 'sm'}
      className={size === 'md' ? 'h-11 w-11 rounded-2xl' : undefined}
    />
  );
};
