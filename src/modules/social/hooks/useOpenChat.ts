import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';

/** Abre (ou cria) a conversa privada com um colega e vai para o Messenger. */
export const useOpenChat = () => {
  const messenger = useOptionalMessenger();
  const navigate = useNavigate();
  const { basePath } = useWorkspace();

  return useCallback(
    async (userId: string) => {
      const id = await messenger?.startDirect(userId);
      if (id) navigate(`${basePath}?c=${id}`);
    },
    [messenger, navigate, basePath]
  );
};
