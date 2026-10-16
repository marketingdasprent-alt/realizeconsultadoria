import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface RenameGroupDialogProps {
  /** Nome atual; null fecha a janela. */
  current: string | null;
  onClose: () => void;
  onSave: (title: string) => void;
}

/** Mudar o nome de um grupo. */
export const RenameGroupDialog: React.FC<RenameGroupDialogProps> = ({
  current,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  useEffect(() => setTitle(current ?? ''), [current]);
  const valid = title.trim().length > 0 && title.trim() !== current;

  return (
    <Dialog open={current !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-sm sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <Users className="h-5 w-5 text-rz-primary" /> Nome do grupo
        </DialogTitle>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!valid) return;
            onSave(title.trim());
            onClose();
          }}
          className="space-y-4"
        >
          <input
            autoFocus
            value={title}
            onChange={event => setTitle(event.target.value.slice(0, 80))}
            onFocus={event => event.target.select()}
            aria-label="Nome do grupo"
            className="h-12 w-full rounded-xl bg-white px-4 text-[15px] font-semibold outline-none ring-2 ring-rz-primary/30 focus:ring-rz-primary"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="h-10 rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
