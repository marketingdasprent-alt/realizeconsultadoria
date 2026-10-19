import React, { useEffect, useState } from 'react';
import { FilePlus2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { isValidName } from '../../../../../supabase/functions/_shared/company-files';
import { NEW_DOCUMENT_KINDS, type NewDocumentKind } from '../../lib/companyFiles';
import { KIND_STYLES } from './fileKindStyles';

interface NewDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Cria o documento; devolve a mensagem de erro, ou null se correu bem. */
  onCreate: (name: string, kind: NewDocumentKind) => Promise<string | null>;
}

/** Novo documento em branco (Word, Excel ou PowerPoint) na pasta aberta. */
export const NewDocumentDialog: React.FC<NewDocumentDialogProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const [kind, setKind] = useState<NewDocumentKind>('docx');
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
  const valid = isValidName(`${trimmed}.${kind}`) && trimmed.length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || isSaving) return;
    setIsSaving(true);
    const message = await onCreate(trimmed, kind);
    setIsSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-md sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <FilePlus2 className="h-5 w-5 text-rz-primary" /> Novo documento
        </DialogTitle>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tipo de documento">
            {NEW_DOCUMENT_KINDS.map(option => {
              const { icon: Icon, tint } = KIND_STYLES[option.fileKind];
              const selected = option.kind === kind;
              return (
                <button
                  key={option.kind}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setKind(option.kind)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-[12.5px] font-semibold ring-1 transition',
                    selected ? 'bg-rz-primary-soft ring-2 ring-rz-primary' : 'ring-rz-line'
                  )}
                >
                  <span
                    className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tint)}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center rounded-xl bg-white ring-2 ring-rz-primary/30 focus-within:ring-rz-primary">
            <input
              autoFocus
              value={name}
              onChange={event => {
                setName(event.target.value.slice(0, 120));
                setError(null);
              }}
              placeholder="Nome do documento"
              aria-label="Nome do documento"
              className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-[15px] font-semibold outline-none"
            />
            <span className="pr-4 text-[14px] font-semibold text-rz-muted">.{kind}</span>
          </div>
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
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Criar e abrir
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
