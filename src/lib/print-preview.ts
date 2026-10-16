// Pré-visualização das impressões dentro do sistema, num iframe. Substitui as janelas novas
// (window.open), que os browsers bloqueiam quando o documento só fica pronto depois de
// carregar dados — o clique do utilizador já "expirou" e aparece o aviso dos pop-ups.
import { useSyncExternalStore } from 'react';

export interface PrintPreview {
  title: string;
  html: string;
}

let current: PrintPreview | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Tira a impressão automática (scripts com window.print) e a barra de botões dos documentos
 * antigos: na pré-visualização imprime-se pelo botão da própria pré-visualização.
 */
export const preparePrintHtml = (html: string): string =>
  html
    .replace(/<script>(?:(?!<\/script>)[\s\S])*?window\.print\(\)[\s\S]*?<\/script>/g, '')
    .replace('</head>', '<style>.toolbar{display:none!important}</style></head>');

/** Mostra o documento na pré-visualização (por cima da página atual). */
export const openPrintPreview = (html: string, title = 'Pré-visualização'): void => {
  current = { title, html: preparePrintHtml(html) };
  emit();
};

export const closePrintPreview = (): void => {
  current = null;
  emit();
};

/** O documento aberto na pré-visualização (null quando fechada). */
export const usePrintPreview = (): PrintPreview | null =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => current
  );
