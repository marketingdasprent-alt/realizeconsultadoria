import React, { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { isValidName } from '../../../../../../supabase/functions/_shared/company-files';
import { folderAccessService } from '../../../services/folderAccessService';

interface NewServerFolderProps {
  /** Pasta aberta, onde a nova é criada. */
  parent: string;
  /** Depois de criar: abre a pasta nova. */
  onCreated: (path: string) => void;
}

/** Criar uma pasta no servidor (D:\Shares) dentro da pasta aberta. */
export const NewServerFolder: React.FC<NewServerFolderProps> = ({ parent, onCreated }) => {
  const [name, setName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const valid = isValidName(trimmed);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || isSaving) return;
    setIsSaving(true);
    const { data, error: createError } = await folderAccessService.createFolder(
      `${parent}/${trimmed}`
    );
    setIsSaving(false);
    if (createError || !data) return setError(createError);
    if (!data.created) return setError('Já existe uma pasta com esse nome.');
    setName('');
    setIsOpen(false);
    setError(null);
    onCreated(data.path);
  };

  if (!isOpen)
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold text-rz-primary hover:bg-rz-primary-soft"
      >
        <FolderPlus className="h-4 w-4" /> Nova pasta aqui
      </button>
    );

  return (
    <form onSubmit={create} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={event => {
            setName(event.target.value.slice(0, 120));
            setError(null);
          }}
          placeholder="Nome da pasta nova"
          aria-label="Nome da pasta nova"
          className="h-10 min-w-0 flex-1 rounded-xl bg-white px-3 text-[14px] font-semibold outline-none ring-2 ring-rz-primary/30 focus:ring-rz-primary"
        />
        <button
          type="submit"
          disabled={!valid || isSaving}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rz-ink px-4 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Criar
        </button>
      </div>
      {trimmed && !valid && (
        <p className="text-[12.5px] text-rose-600">
          O nome não pode ter {'< > : " / | ? *'} nem acabar em ponto.
        </p>
      )}
      {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
    </form>
  );
};
