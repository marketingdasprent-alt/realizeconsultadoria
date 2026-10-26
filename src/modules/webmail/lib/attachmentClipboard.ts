// "Copiar anexo": o navegador não deixa pôr PDFs na área de transferência do sistema, por isso
// o anexo copiado fica aqui (nesta sessão) e o editor de email oferece-o para colar.
import { useSyncExternalStore } from 'react';

let copied: File[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export const attachmentClipboard = {
  copy: (files: File[]) => {
    copied = files;
    emit();
  },
  clear: () => {
    copied = [];
    emit();
  },
  get: () => copied,
};

/** Anexos copiados (para o editor mostrar "Colar"). */
export const useCopiedAttachments = () =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => copied
  );
