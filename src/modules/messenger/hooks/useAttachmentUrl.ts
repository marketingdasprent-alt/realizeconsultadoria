import { useEffect, useState } from 'react';
import { useMessengerApi } from '../context/useMessengerApi';
import type { ChatMessage } from '../types';

/** URL para mostrar um anexo: a pré-visualização local (a enviar) ou um URL temporário. */
export const useAttachmentUrl = (message: Pick<ChatMessage, 'attachment' | 'localUrl'>) => {
  const { getFileUrl } = useMessengerApi();
  const path = message.attachment?.path;
  const [url, setUrl] = useState<string | null>(message.localUrl ?? null);

  useEffect(() => {
    if (message.localUrl) {
      setUrl(message.localUrl);
      return;
    }
    if (!path) return;
    let alive = true;
    getFileUrl(path).then(signed => alive && setUrl(signed));
    return () => {
      alive = false;
    };
  }, [path, message.localUrl, getFileUrl]);

  return url;
};
