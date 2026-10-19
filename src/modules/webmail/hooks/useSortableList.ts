import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dropIndex, moveItem } from '../lib/accountOrder';

interface DragState {
  id: string;
  order: string[];
}

/**
 * Reordenar uma lista curta arrastando uma pega (rato e toque, com pointer events) ou com as
 * setas do teclado na pega. Enquanto se arrasta, `order` já mostra a ordem nova; `onMove`
 * recebe a ordem final ao largar (só se mudou).
 */
export const useSortableList = (ids: string[], onMove: (ids: string[]) => void) => {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Os pointermove chegam mais depressa do que os renders: o estado atual vive aqui.
  const live = useRef<DragState | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());

  const update = (next: DragState | null) => {
    live.current = next;
    setDrag(next);
  };
  const finish = (commit: boolean) => {
    const last = live.current;
    update(null);
    if (commit && last && last.order.join() !== ids.join()) onMove(last.order);
  };

  return {
    order: drag?.order ?? ids,
    dragging: drag?.id ?? null,
    rowRef: (id: string) => (element: HTMLElement | null) => {
      if (element) rows.current.set(id, element);
      else rows.current.delete(id);
    },
    handleProps: (id: string) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        update({ id, order: ids });
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const state = live.current;
        if (!state || state.id !== id) return;
        const centers = state.order.map(rowId => {
          const rect = rows.current.get(rowId)?.getBoundingClientRect();
          return rect ? rect.top + rect.height / 2 : 0;
        });
        const from = state.order.indexOf(id);
        const to = dropIndex(centers, from, event.clientY);
        if (to !== from) update({ id, order: moveItem(state.order, from, to) });
      },
      onPointerUp: () => finish(true),
      onPointerCancel: () => finish(false),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
        const from = ids.indexOf(id);
        if (!step || from + step < 0 || from + step >= ids.length) return;
        event.preventDefault();
        onMove(moveItem(ids, from, from + step));
      },
    }),
  };
};
