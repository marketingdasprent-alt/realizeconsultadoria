import React, { useEffect, useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { useAccountFolders } from '../hooks/useAccountFolders';
import { flattenFolders } from '../lib/folderTree';
import { ACCOUNT_DOTS, accountName } from '../lib/mailFormat';
import type { MailAccount } from '../types';

interface NewMailFolderDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: MailAccount[];
  /** Caixa onde criar; null = a pessoa escolhe (vista de todas as caixas). */
  accountId: string | null;
  /** Subpasta de... (já escolhida, p. ex. pelo "+" ao lado de uma pasta). */
  parentId?: string | null;
  /** Cria a pasta; devolve a mensagem de erro, ou null se correu bem. */
  onCreate: (accountId: string, name: string, parentId: string | null) => Promise<string | null>;
}

/** Nome com que o servidor não se dá bem: separadores, pontos e caracteres de controlo. */
// eslint-disable-next-line no-control-regex -- é mesmo para barrar os caracteres de controlo
const INVALID_NAME = /[\\/.\u0000-\u001f]/;

/** Nova pasta (ou subpasta) numa caixa de email. */
export const NewMailFolderDialog: React.FC<NewMailFolderDialogProps> = ({
  open,
  onClose,
  accounts,
  accountId,
  parentId = null,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [account, setAccount] = useState<string | null>(accountId);
  const [parent, setParent] = useState<string>(parentId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const folders = useAccountFolders(open ? account : null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
    setAccount(accountId ?? (accounts.length === 1 ? accounts[0].id : null));
    setParent(parentId ?? '');
  }, [open, accountId, parentId, accounts]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !INVALID_NAME.test(trimmed);
  const options = [
    { value: '', label: 'Sem pasta-mãe (no topo)' },
    ...flattenFolders(folders.data ?? []).map(({ folder, depth }) => ({
      value: folder.id,
      label: `${'— '.repeat(depth)}${folder.name}`,
    })),
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !account || isSaving) return;
    setIsSaving(true);
    const message = await onCreate(account, trimmed, parent || null);
    setIsSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && !isSaving && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-sm sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <FolderPlus className="h-5 w-5 text-rz-primary" /> Nova pasta
        </DialogTitle>
        <form onSubmit={submit} className="space-y-3">
          {accountId === null && accounts.length > 1 && (
            <div>
              <p className="mb-1 text-[12px] font-bold text-rz-muted">Na caixa</p>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAccount(item.id);
                      setParent('');
                    }}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1',
                      account === item.id
                        ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary'
                        : 'bg-white text-rz-muted ring-rz-line hover:text-rz-ink'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', ACCOUNT_DOTS[item.color])} />
                    {accountName(item)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            autoFocus
            value={name}
            onChange={event => {
              setName(event.target.value.slice(0, 100));
              setError(null);
            }}
            placeholder="Nome da pasta (ex.: Tratados)"
            aria-label="Nome da pasta"
            className="h-12 w-full rounded-xl bg-white px-4 text-[15px] font-semibold outline-none ring-2 ring-rz-primary/30 focus:ring-rz-primary"
          />
          {trimmed && !valid && (
            <p className="text-[13px] text-rose-600">O nome não pode ter barras nem pontos.</p>
          )}
          {account && (
            <div>
              <p className="mb-1 text-[12px] font-bold text-rz-muted">Dentro de</p>
              <RzSelect
                value={parent}
                onChange={setParent}
                options={options}
                ariaLabel="Pasta-mãe"
                className="h-10 w-full rounded-xl bg-white px-3 text-[14px] ring-1 ring-rz-line"
              />
            </div>
          )}
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!valid || !account || isSaving}
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
