import { useEffect } from 'react';
import '../workspace.css';

let mounted = 0;

/**
 * Põe a classe rz-theme no <html> enquanto houver um ecrã da área do colaborador
 * aberto: os tokens chegam também aos popovers e diálogos (renderizados em portais).
 */
export const useRzTheme = (): void => {
  useEffect(() => {
    mounted += 1;
    document.documentElement.classList.add('rz-theme');
    return () => {
      mounted -= 1;
      if (mounted === 0) document.documentElement.classList.remove('rz-theme');
    };
  }, []);
};
