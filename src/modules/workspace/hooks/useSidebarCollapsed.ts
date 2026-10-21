import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rz.sidebar.collapsed';

const read = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/** Menu lateral recolhido ou expandido, lembrado neste browser (uma chave por área). */
export const useSidebarCollapsed = (storageKey = STORAGE_KEY): [boolean, () => void] => {
  const [collapsed, setCollapsed] = useState(() => read(storageKey));

  const toggle = useCallback(() => {
    setCollapsed(current => {
      const next = !current;
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // Sem armazenamento (modo privado): fica só nesta sessão.
      }
      return next;
    });
  }, [storageKey]);

  return [collapsed, toggle];
};
