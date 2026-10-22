import React, { useRef } from 'react';
import { SIDEBAR_MAX, SIDEBAR_MIN, clampSidebarWidth } from '../lib/sidebarWidth';

interface SidebarResizerProps {
  width: number;
  onChange: (width: number) => void;
  onCommit: (width: number) => void;
}

/** Pega na margem da coluna das caixas: arrastar muda a largura; duplo clique repõe; setas também. */
export const SidebarResizer: React.FC<SidebarResizerProps> = ({ width, onChange, onCommit }) => {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const latest = useRef(width);
  latest.current = width;

  const move = (clientX: number) => {
    if (!drag.current) return;
    onChange(clampSidebarWidth(drag.current.startWidth + clientX - drag.current.startX));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura da coluna das caixas"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Arrastar para mudar a largura (duplo clique repõe)"
      className="group relative z-10 hidden w-1.5 shrink-0 cursor-col-resize touch-none lg:block"
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidth: latest.current };
      }}
      onPointerMove={event => move(event.clientX)}
      onPointerUp={() => {
        if (!drag.current) return;
        drag.current = null;
        onCommit(latest.current);
      }}
      onDoubleClick={() => {
        onChange(250);
        onCommit(250);
      }}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = clampSidebarWidth(latest.current + (event.key === 'ArrowRight' ? 16 : -16));
        onChange(next);
        onCommit(next);
      }}
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-rz-line transition-colors group-hover:bg-rz-primary/50 group-focus-visible:bg-rz-primary" />
    </div>
  );
};
