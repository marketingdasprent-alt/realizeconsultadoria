import { useCallback, useState } from 'react';

const KEY = 'rz.mail.search-all-folders';

const read = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** Pesquisar em todas as pastas (e não só na aberta): a escolha fica neste browser. */
export const useSearchAllFolders = (): [boolean, (value: boolean) => void] => {
  const [value, setValue] = useState(read);
  const change = useCallback((next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // Sem armazenamento (modo privado): fica só nesta sessão.
    }
  }, []);
  return [value, change];
};
