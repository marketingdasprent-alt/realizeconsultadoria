import { createContext, useContext } from 'react';

/** Abre uma imagem da conversa na galeria (quem a mostra é a lista de mensagens). */
export const ImageViewerContext = createContext<((messageId: string) => void) | null>(null);

export const useImageViewer = () => useContext(ImageViewerContext);
