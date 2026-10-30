import React from 'react';
import { Forward, X } from 'lucide-react';

interface SelectionBarProps {
  count: number;
  onCancel: () => void;
  onForward: () => void;
}

/** No lugar da caixa de escrita enquanto se escolhem mensagens: quantas e "Encaminhar". */
export const SelectionBar: React.FC<SelectionBarProps> = ({ count, onCancel, onForward }) => (
  <div className="px-3 pb-3 pt-2 md:px-5 md:pb-5">
    <div className="flex items-center gap-2 rounded-[24px] bg-white p-1.5 pl-2 shadow-rz-soft ring-1 ring-rz-line">
      <button
        type="button"
        onClick={onCancel}
        className="flex h-10 w-10 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
        aria-label="Cancelar seleção"
      >
        <X className="h-5 w-5" />
      </button>
      <span className="flex-1 text-[14px] font-semibold">
        {count === 0
          ? 'Toque nas mensagens a encaminhar'
          : `${count} ${count === 1 ? 'mensagem selecionada' : 'mensagens selecionadas'}`}
      </span>
      <button
        type="button"
        onClick={onForward}
        disabled={count === 0}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-[14px] font-bold text-white disabled:opacity-50"
      >
        <Forward className="h-4 w-4" /> Encaminhar
      </button>
    </div>
  </div>
);
