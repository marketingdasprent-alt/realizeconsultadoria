import { useCallback, useEffect, useRef, useState } from 'react';

const WINDOW_NAME = 'realize-nova-mensagem';
const POPOUT_WIDTH = 780;
const POPOUT_HEIGHT = 820;

/** Copia para a janela nova o que dá aspeto à página (folhas de estilo, tema e fontes). */
const copyLook = (target: Window) => {
  const source = document;
  const head = target.document.head;
  source.head.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style').forEach(node => {
    const copy = node.cloneNode(true) as HTMLElement;
    // Endereço completo: a janela nova começa em branco e não sabe de onde partir.
    if (copy instanceof HTMLLinkElement) copy.href = (node as HTMLLinkElement).href;
    head.appendChild(copy);
  });
  const sync = () => {
    const html = target.document.documentElement;
    html.className = source.documentElement.className;
    html.lang = source.documentElement.lang;
    html.setAttribute('style', source.documentElement.getAttribute('style') ?? '');
    target.document.body.className = source.body.className;
  };
  sync();
  // Tema claro/escuro mudado na janela principal: acompanha.
  const observer = new MutationObserver(sync);
  observer.observe(source.documentElement, { attributes: true });
  return () => observer.disconnect();
};

export interface Popout {
  /** Onde desenhar a mensagem (o corpo da janela nova); null com a janela fechada. */
  container: HTMLElement | null;
  /** Abre a janela. Devolve false se o navegador a bloqueou. */
  open: () => boolean;
  close: () => void;
}

/**
 * Janela própria do navegador (para levar a mensagem a outro monitor). A mensagem continua a
 * viver na janela principal e desenha-se na nova por um portal: o rascunho, o envio e os anexos
 * são os mesmos. Se a janela nova fechar, `onClosed` avisa (a mensagem volta à principal).
 */
export const useWindowPopout = (active: boolean, onClosed: () => void): Popout => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const popup = useRef<Window | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;

  const teardown = useCallback((closeWindow: boolean) => {
    cleanup.current?.();
    cleanup.current = null;
    const current = popup.current;
    popup.current = null;
    setContainer(null);
    if (closeWindow && current && !current.closed) current.close();
  }, []);

  const open = useCallback(() => {
    if (popup.current && !popup.current.closed) {
      popup.current.focus();
      return true;
    }
    const left = Math.round(window.screenX + 60);
    const top = Math.round(window.screenY + 60);
    const next = window.open(
      '',
      WINDOW_NAME,
      `popup=yes,width=${POPOUT_WIDTH},height=${POPOUT_HEIGHT},left=${left},top=${top}`
    );
    if (!next) return false;
    next.document.title = 'Nova mensagem';
    next.document.body.style.margin = '0';
    const root = next.document.createElement('div');
    root.style.cssText = 'height:100vh;width:100vw;';
    next.document.body.appendChild(root);
    const stopLook = copyLook(next);

    let ended = false;
    // Janela fechada pela pessoa (no X do sistema): a mensagem volta à janela principal.
    const onGone = () => {
      if (ended) return;
      ended = true;
      teardown(false);
      closedRef.current();
    };
    next.addEventListener('pagehide', onGone);
    const poll = window.setInterval(() => next.closed && onGone(), 500);
    // A principal recarrega ou fecha: a nova fecha com ela (a mensagem fica guardada na sessão).
    const onMainLeaving = () => next.close();
    window.addEventListener('pagehide', onMainLeaving);

    cleanup.current = () => {
      ended = true;
      stopLook();
      window.clearInterval(poll);
      window.removeEventListener('pagehide', onMainLeaving);
      next.removeEventListener('pagehide', onGone);
    };
    popup.current = next;
    setContainer(root);
    return true;
  }, [teardown]);

  const close = useCallback(() => teardown(true), [teardown]);

  // Mensagem enviada ou descartada: fecha a janela.
  useEffect(() => {
    if (!active) teardown(true);
  }, [active, teardown]);
  // Saiu do Email (a página desmonta): fecha a janela; a mensagem fica na sessão.
  useEffect(() => () => teardown(true), [teardown]);

  return { container, open, close };
};
