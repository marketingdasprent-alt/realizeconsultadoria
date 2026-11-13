import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

/** Abaixo disto (telemóvel) a janela fica sempre grande: não há onde a pôr ao lado. */
export const FLOAT_MIN_VIEWPORT = 640;
/** Largura e altura da janela solta (como o Outlook: cabe ao lado da lista de emails). */
const FLOAT_WIDTH = 640;
const FLOAT_HEIGHT = 680;
const MARGIN = 8;
/** Parte da barra de título que fica sempre dentro do ecrã, para ser possível voltar a pegar. */
const KEEP_VISIBLE = 120;
const DRAG_THRESHOLD = 4;

export interface Viewport {
  width: number;
  height: number;
}

export interface FloatPosition {
  x: number;
  y: number;
}

export const floatSize = (viewport: Viewport) => ({
  width: Math.min(FLOAT_WIDTH, viewport.width - MARGIN * 2),
  height: Math.min(FLOAT_HEIGHT, viewport.height - MARGIN * 2),
});

/** Mantém a barra de título dentro do ecrã (nunca se perde a janela fora dele). */
export const clampFloat = (position: FloatPosition, viewport: Viewport): FloatPosition => {
  const { width, height } = floatSize(viewport);
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));
  return {
    x: clamp(position.x, KEEP_VISIBLE - width, viewport.width - KEEP_VISIBLE),
    // Na vertical fica toda à vista (o botão Enviar não pode ficar fora do ecrã).
    y: clamp(position.y, 0, viewport.height - height),
  };
};

/** Canto inferior direito, por cima da lista (onde fica a janela ao soltar com o botão). */
export const dockedPosition = (viewport: Viewport): FloatPosition => {
  const { width, height } = floatSize(viewport);
  return clampFloat(
    { x: viewport.width - width - MARGIN * 2, y: viewport.height - height - MARGIN * 2 },
    viewport
  );
};

/** O painel solto leva este atributo: é por ele que se encontra ao mover. */
export const FLOATING_ATTRIBUTE = 'data-floating-window';
const FLOATING_SELECTOR = `[${FLOATING_ATTRIBUTE}]`;

/** Posição por transform (só compõe, não refaz o layout a cada movimento). */
const moveTo = (position: FloatPosition) => `translate3d(${position.x}px, ${position.y}px, 0)`;

const viewportNow = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * Janela que se solta e arrasta pela barra de título. Enquanto está solta não bloqueia a
 * página: dá para abrir outros emails por baixo, como no Outlook.
 */
export const useFloatingWindow = (active: boolean) => {
  const [position, setPosition] = useState<FloatPosition | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  const floating = position !== null;

  // Janela fechada ou enviada: a próxima abre outra vez no centro.
  useEffect(() => {
    if (!active) setPosition(null);
  }, [active]);

  // Se a janela fechar a meio do arrasto, largam-se os ouvintes.
  useEffect(() => () => stopDrag.current?.(), []);

  useEffect(() => {
    if (!floating) return;
    const onResize = () => {
      if (window.innerWidth < FLOAT_MIN_VIEWPORT) return setPosition(null);
      setPosition(current => (current ? clampFloat(current, viewportNow()) : current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [floating]);

  const undock = useCallback(() => setPosition(null), []);
  const dock = useCallback(() => {
    if (window.innerWidth >= FLOAT_MIN_VIEWPORT) setPosition(dockedPosition(viewportNow()));
  }, []);

  const floatingRef = useRef(floating);
  floatingRef.current = floating;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || window.innerWidth < FLOAT_MIN_VIEWPORT) return;
    const panel = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    stopDrag.current?.();
    const rect = panel.getBoundingClientRect();
    const width = floating ? rect.width : floatSize(viewportNow()).width;
    // Na janela grande, a pega fica na mesma proporção da barra (não salta para longe do rato).
    const grabX = floating
      ? event.clientX - rect.left
      : ((event.clientX - rect.left) / rect.width) * width;
    const grabY = event.clientY - rect.top;
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    let latest: FloatPosition | null = null;
    let frame = 0;

    // Um quadro de cada vez, e depois de solta a janela move-se direto no DOM: refazer o
    // compositor inteiro (centenas de elementos) a cada movimento do rato deixava o arrasto lento.
    const paint = () => {
      frame = 0;
      if (!latest) return;
      const panelNow = floatingRef.current
        ? document.querySelector<HTMLElement>(FLOATING_SELECTOR)
        : null;
      if (panelNow) panelNow.style.transform = moveTo(latest);
      else setPosition(latest); // primeiro movimento: passa de modal a solta
    };
    // Ouvintes na janela, não na barra: ao soltar, a janela passa de modal a solta e os
    // seus elementos são recriados a meio do arrasto.
    const onMove = (move: PointerEvent) => {
      if (!moved && Math.hypot(move.clientX - start.x, move.clientY - start.y) < DRAG_THRESHOLD)
        return;
      if (!moved) document.body.style.userSelect = 'none';
      moved = true;
      latest = clampFloat({ x: move.clientX - grabX, y: move.clientY - grabY }, viewportNow());
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const end = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (frame) cancelAnimationFrame(frame);
      document.body.style.userSelect = '';
      stopDrag.current = null;
      // Grava a posição final no estado (para o resto da aplicação e para o redimensionar).
      if (latest) setPosition(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    stopDrag.current = end;
  };

  const size = floatSize(viewportNow());
  const style: React.CSSProperties | undefined = position
    ? {
        left: 0,
        top: 0,
        transform: moveTo(position),
        width: size.width,
        height: size.height,
      }
    : undefined;

  return {
    floating,
    style,
    dock,
    undock,
    handleProps: { onPointerDown },
    /** Atributos do painel: marca-o e tira a transição da base (senão a janela "arrasta atrás"). */
    panelProps: floating ? { [FLOATING_ATTRIBUTE]: '' } : {},
  };
};
