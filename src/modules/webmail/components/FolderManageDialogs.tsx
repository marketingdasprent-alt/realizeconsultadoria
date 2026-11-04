import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface FolderEdit {
  kind: 'rename' | 'delete';
  accountId: string;
  folderId: string;
  name: string;
}

interface FolderManageDialogsProps {
  edit: FolderEdit | null;
  onClose: () => void;
  /** Devolvem a mensagem de erro, ou null se correu bem. */
  onRename: (edit: FolderEdit, name: string) => Promise<string | null>;
  onDelete: (edit: FolderEdit) => Promise<string | null>;
}

// eslint-disable-next-line no-control-regex -- é mesmo para barrar os caracteres de controlo
const INVALID_NAME = /[\\/.\u0000-\u001f]/;

/** Mudar o nome de uma pasta e apagá-la (a pergunta de confirmação). */
export const FolderManageDialogs: React.FC<FolderManageDialogsProps> = ({
  edit,
  onClose,
  onRename,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setName(edit?.name ?? '');
    setError(null);
  }, [edit]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !INVALID_NAME.test(trimmed) && trimmed !== edit?.name;
  const isDelete = edit?.kind === 'delete';

  const submit = async () => {
    if (!edit || isBusy || (!isDelete && !valid)) return;
    setIsBusy(true);
    const message = await (isDelete ? onDelete(edit) : onRename(edit, trimmed));
    setIsBusy(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open={!!edit} onOpenChange={next => !next && !isBusy && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-sm sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          {isDelete ? (
            <Trash2 className="h-5 w-5 text-rose-600" />
          ) : (
            <Pencil className="h-5 w-5 text-rz-primary" />
          )}
          {isDelete ? 'Apagar pasta' : 'Mudar o nome da pasta'}
        </DialogTitle>
        {isDelete ? (
          <DialogDescription className="text-[13.5px]">
            Apagar “{edit?.name}” e as subpastas? Os emails que lá estão vão para o Lixo (no Gmail
            ficam só sem a etiqueta). As regras e marcadores que moviam para aqui deixam de mover.
          </DialogDescription>
        ) : (
          <input
            autoFocus
            value={name}
            onChange={event => {
              setName(event.target.value.slice(0, 100));
              setError(null);
            }}
            onKeyDown={event => event.key === 'Enter' && void submit()}
            aria-label="Novo nome da pasta"
            className="h-12 w-full rounded-xl bg-white px-4 text-[15px] font-semibold outline-none ring-2 ring-rz-primary/30 focus:ring-rz-primary"
          />
        )}
        {!isDelete && trimmed && INVALID_NAME.test(trimmed) && (
          <p className="text-[13px] text-rose-600">O nome não pode ter barras nem pontos.</p>
        )}
        {error && <p className="text-[13px] text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isBusy || (!isDelete && !valid)}
            onClick={() => void submit()}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-40',
              isDelete ? 'bg-rose-600' : 'bg-rz-primary'
            )}
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDelete ? 'Apagar' : 'Guardar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
