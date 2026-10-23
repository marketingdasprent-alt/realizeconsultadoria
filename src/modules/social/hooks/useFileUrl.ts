import { useEffect, useState } from 'react';
import { feedService } from '../services/feedService';

const feedUrl = async (path: string) => (await feedService.getFileUrl(path)).data;

/**
 * URL temporário do ficheiro (na pré-visualização o caminho já é um URL local).
 * `resolve`: de onde vem o URL (por omissão, os ficheiros do Feed).
 */
export const useFileUrl = (
  path: string,
  resolve: (path: string) => Promise<string | null> = feedUrl
) => {
  const [url, setUrl] = useState<string | null>(path.startsWith('blob:') ? path : null);
  useEffect(() => {
    if (path.startsWith('blob:')) {
      setUrl(path);
      return;
    }
    let alive = true;
    setUrl(null);
    if (!path) return;
    resolve(path).then(result => alive && setUrl(result));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve é fixo por quem chama
  }, [path]);
  return url;
};
