import React from 'react';
import { Pencil, Reply, X } from 'lucide-react';

interface ComposerBannerProps {
  mode: 'reply' | 'edit';
  title: string;
  text: string;
  onCancel: () => void;
}

/** Faixa acima da caixa de escrita: a responder a uma mensagem ou a editar a sua. */
export const ComposerBanner: React.FC<ComposerBannerProps> = ({ mode, title, text, onCancel }) => {
  const Icon = mode === 'reply' ? Reply : Pencil;
  return (
    <div className="rz-rise mx-1.5 mb-1.5 flex items-center gap-3 rounded-2xl bg-rz-primary-soft px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-rz-primary" />
      <div className="min-w-0 flex-1 border-l-[3px] border-rz-primary pl-2.5">
        <p className="text-xs font-bold text-rz-primary">{title}</p>
        <p className="truncate text-[13px] text-rz-muted">{text}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-white"
        aria-label="Cancelar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
