import React, { useEffect, useState } from 'react';
import { ArrowRight, Pencil, Plus, Sparkles, Tag, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAccountLabels, useLabelEditor } from '../hooks/useMailLabels';
import { ACCOUNT_DOTS, accountName } from '../lib/mailFormat';
import { labelStyle } from '../lib/labelColors';
import type { MailAccount, MailLabel } from '../types';
import { LabelForm } from './LabelForm';

interface ManageLabelsDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: MailAccount[];
  /** Caixa à vista (null = a primeira). */
  accountId: string | null;
}

const automationText = (label: MailLabel, byId: Map<string, MailLabel>) =>
  [
    label.onApply.folderName && `move para ${label.onApply.folderName}`,
    label.onApply.markRead && 'marca como lido',
    label.onApply.removeLabelIds.length > 0 &&
      `tira ${label.onApply.removeLabelIds
        .map(id => byId.get(id)?.name)
        .filter(Boolean)
        .join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ');

/** Marcadores coloridos de uma caixa: criar, mudar a cor, definir a automação e apagar. */
export const ManageLabelsDialog: React.FC<ManageLabelsDialogProps> = ({
  open,
  onClose,
  accounts,
  accountId,
}) => {
  const [account, setAccount] = useState<string | null>(null);
  const [editing, setEditing] = useState<MailLabel | 'new' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labels = useAccountLabels(account);
  const editor = useLabelEditor(account);

  useEffect(() => {
    if (!open) return;
    setAccount(
      accountId && accounts.some(a => a.id === accountId) ? accountId : (accounts[0]?.id ?? null)
    );
    setEditing(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [open]);

  const list = labels.data ?? [];
  const byId = new Map(list.map(label => [label.id, label]));

  const save = async (value: Pick<MailLabel, 'name' | 'color' | 'onApply'>) => {
    setIsSaving(true);
    setError(null);
    const result = await editor.save({
      id: editing && editing !== 'new' ? editing.id : undefined,
      ...value,
    });
    setIsSaving(false);
    if (result.error) setError(result.error);
    else setEditing(null);
  };

  // Atalho: "Por tratar" e "Tratado" (que tira o "Por tratar" e marca como lido) e "Urgente"
  const addSuggestions = async () => {
    setIsSaving(true);
    const pending = await editor.save({
      name: 'Por tratar',
      color: 'red',
      onApply: { folderId: null, folderName: null, markRead: false, removeLabelIds: [] },
    });
    await editor.save({
      name: 'Tratado',
      color: 'green',
      onApply: {
        folderId: null,
        folderName: null,
        markRead: true,
        removeLabelIds: pending.id ? [pending.id] : [],
      },
    });
    await editor.save({
      name: 'Urgente',
      color: 'orange',
      onApply: { folderId: null, folderName: null, markRead: false, removeLabelIds: [] },
    });
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <Tag className="h-5 w-5 text-rz-primary" /> Marcadores
        </DialogTitle>
        <DialogDescription className="text-[13px]">
          Cores para organizar os emails. Quem usa a caixa vê os mesmos marcadores, e um email pode
          ter vários.
        </DialogDescription>

        {accounts.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {accounts.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAccount(item.id);
                  setEditing(null);
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
        )}

        {!labels.isLoading && list.length === 0 && editing === null && (
          <div className="rounded-2xl bg-rz-canvas px-4 py-5 text-center">
            <p className="text-[13.5px] text-rz-muted">Ainda não há marcadores nesta caixa.</p>
            <button
              type="button"
              onClick={() => void addSuggestions()}
              disabled={isSaving}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-rz-primary ring-1 ring-rz-line hover:bg-rz-primary-soft disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" /> Criar “Por tratar”, “Tratado” e “Urgente”
            </button>
          </div>
        )}

        <ul className="space-y-1.5">
          {list.map(label => (
            <li key={label.id} className="rounded-2xl bg-white p-2.5 ring-1 ring-rz-line">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn('h-3.5 w-3.5 shrink-0 rounded-full', labelStyle(label.color).dot)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{label.name}</p>
                  {automationText(label, byId) && (
                    <p className="flex items-center gap-1 truncate text-[12px] text-rz-muted">
                      <ArrowRight className="h-3 w-3 shrink-0" /> {automationText(label, byId)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(label)}
                  aria-label={`Editar ${label.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void editor.remove(label.id)}
                  aria-label={`Apagar ${label.name}`}
                  title="Apagar (sai de todos os emails)"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {account && editing ? (
          <LabelForm
            key={editing === 'new' ? 'new' : editing.id}
            accountId={account}
            label={editing === 'new' ? undefined : editing}
            others={list.filter(item => editing === 'new' || item.id !== editing.id)}
            isSaving={isSaving}
            error={error}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
            onSave={value => void save(value)}
          />
        ) : (
          account && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" /> Novo marcador
            </button>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};
