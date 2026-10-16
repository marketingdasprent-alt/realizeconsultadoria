import React, { useEffect, useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { isValidName } from '../../../../../supabase/functions/_shared/company-files';

interface NewFolderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Cria a pasta; devolve a mensagem de erro, ou null se correu bem. */
  onCreate: (name: string) => Promise<string | null>;
}

/** Nova pasta dentro da pasta aberta. */
export const NewFolderDialog: React.FC<NewFolderDialogProps> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  const trimmed = name.trim();
  const valid = isValidName(trimmed);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || isSaving) return;
    setIsSaving(true);
    const message = await onCreate(trimmed);
    setIsSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-sm sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <FolderPlus className="h-5 w-5 text-rz-primary" /> Nova pasta
        </DialogTitle>
        <form onSubmit={submit} className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={event => {
              setName(event.target.value.slice(0, 120));
              setError(null);
            }}
            placeholder="Nome da pasta"
            aria-label="Nome da pasta"
            className="h-12 w-full rounded-xl bg-white px-4 text-[15px] font-semibold outline-none ring-2 ring-rz-primary/30 focus:ring-rz-primary"
          />
          {trimmed && !valid && (
            <p className="text-[13px] text-rose-600">
              O nome não pode ter {'< > : " / | ? *'} nem acabar em ponto.
            </p>
          )}
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
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
              disabled={!valid || isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Criar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
