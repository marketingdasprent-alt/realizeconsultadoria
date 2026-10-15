import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rz.sidebar.collapsed';

const read = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/** Menu lateral recolhido ou expandido, lembrado neste browser. */
export const useSidebarCollapsed = (): [boolean, () => void] => {
  const [collapsed, setCollapsed] = useState(read);

  const toggle = useCallback(() => {
    setCollapsed(current => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Sem armazenamento (modo privado): fica só nesta sessão.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
};
