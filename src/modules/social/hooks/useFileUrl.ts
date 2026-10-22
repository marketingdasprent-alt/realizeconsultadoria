import { useEffect, useState } from 'react';
import { feedService } from '../services/feedService';

/** URL temporário do ficheiro (na pré-visualização o caminho já é um URL local). */
export const useFileUrl = (path: string) => {
  const [url, setUrl] = useState<string | null>(path.startsWith('blob:') ? path : null);
  useEffect(() => {
    if (path.startsWith('blob:')) {
      setUrl(path);
      return;
    }
    let alive = true;
    setUrl(null);
    feedService.getFileUrl(path).then(result => alive && setUrl(result.data));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
};
