// Imagens do Feed: sem "abrir noutro separador", "guardar imagem" nem arrastar para fora.
// É uma barreira de uso normal (o menu do botão direito e o arrastar); quem tira uma captura
// de ecrã ou usa as ferramentas do navegador continua a conseguir.
import { useEffect } from 'react';

const isImage = (target: EventTarget | null): boolean =>
  target instanceof HTMLImageElement ||
  (target instanceof Element && !!target.closest('[data-protected-image]'));

export const useProtectImages = () => {
  useEffect(() => {
    const block = (event: Event) => {
      if (isImage(event.target)) event.preventDefault();
    };
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
    };
  }, []);
};
