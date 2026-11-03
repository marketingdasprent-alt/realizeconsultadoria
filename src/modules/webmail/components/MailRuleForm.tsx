import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { cn } from '@/lib/utils';
import { useAccountFolders } from '../hooks/useAccountFolders';
import { useAccountLabels } from '../hooks/useMailLabels';
import { labelStyle } from '../lib/labelColors';
import { flattenFolders } from '../lib/folderTree';

export interface RuleDraft {
  fromContains: string;
  keyword: string;
  folderId: string;
  /** Marcadores a pôr. */
  labelIds: string[];
  markRead: boolean;
  applyNow: boolean;
}

interface MailRuleFormProps {
  accountId: string;
  /** Valores de partida (ex.: o remetente do email onde se carregou). */
  initial?: Partial<RuleDraft>;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (draft: RuleDraft, folderName: string) => void;
}

const FIELD =
  'h-10 w-full rounded-xl bg-white px-3 text-[14px] font-medium outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary';

/** Nova regra: de quem / palavra-chave → pasta (e marcar como lido). */
export const MailRuleForm: React.FC<MailRuleFormProps> = ({
  accountId,
  initial,
  isSaving,
  onCancel,
  onSave,
}) => {
  const folders = useAccountFolders(accountId);
  const list = flattenFolders(folders.data ?? []);
  const [draft, setDraft] = useState<RuleDraft>({
    fromContains: initial?.fromContains ?? '',
    keyword: initial?.keyword ?? '',
    folderId: initial?.folderId ?? '',
    labelIds: initial?.labelIds ?? [],
    markRead: initial?.markRead ?? false,
    applyNow: initial?.applyNow ?? true,
  });
  const set = (patch: Partial<RuleDraft>) => setDraft(current => ({ ...current, ...patch }));
  const folder = list.find(item => item.folder.id === draft.folderId)?.folder;
  const labels = useAccountLabels(accountId).data ?? [];
  const valid =
    (draft.fromContains.trim() || draft.keyword.trim()) && (!!folder || draft.labelIds.length > 0);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (valid) onSave(draft, folder?.name ?? '');
      }}
      className="space-y-3 rounded-2xl bg-rz-canvas p-3"
    >
      <label className="block">
        <span className="mb-1 block text-[12px] font-bold text-rz-muted">
          Quando o remetente tiver…
        </span>
        <input
          value={draft.fromContains}
          onChange={event => set({ fromContains: event.target.value.slice(0, 200) })}
          placeholder="ex.: @fidelidade.pt"
          className={FIELD}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-bold text-rz-muted">
          e/ou o email falar de… (palavra-chave)
        </span>
        <input
          value={draft.keyword}
          onChange={event => set({ keyword: event.target.value.slice(0, 200) })}
          placeholder="ex.: apólice"
          className={FIELD}
        />
      </label>
      <div>
        <span className="mb-1 block text-[12px] font-bold text-rz-muted">Pôr os marcadores</span>
        <div className="flex flex-wrap gap-1.5">
          {labels.map(label => {
            const checked = draft.labelIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={checked}
                onClick={() =>
                  set({
                    labelIds: checked
                      ? draft.labelIds.filter(id => id !== label.id)
                      : [...draft.labelIds, label.id],
                  })
                }
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1',
                  checked
                    ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary'
                    : 'bg-white text-rz-muted ring-rz-line'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', labelStyle(label.color).dot)} />
                {label.name}
              </button>
            );
          })}
          {labels.length === 0 && (
            <p className="text-[12px] text-rz-muted">
              Ainda não há marcadores nesta caixa (crie-os em “Marcadores”).
            </p>
          )}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-[12px] font-bold text-rz-muted">
          Mover para a pasta (opcional)
        </span>
        <RzSelect
          value={draft.folderId}
          onChange={folderId => set({ folderId })}
          placeholder={folders.isLoading ? 'A carregar…' : 'Não mover'}
          options={[
            { value: '', label: 'Não mover' },
            ...list.map(({ folder: item, depth }) => ({
              value: item.id,
              label: `${'— '.repeat(depth)}${item.name}`,
            })),
          ]}
          ariaLabel="Pasta de destino"
          className="h-10 w-full rounded-xl bg-white px-3 text-[14px] ring-1 ring-rz-line"
        />
        {!folders.isLoading && list.length === 0 && (
          <p className="mt-1 text-[12px] text-amber-700">
            Esta caixa ainda não tem pastas. Crie uma primeiro em “As minhas pastas”.
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-[13.5px] font-medium">
        <input
          type="checkbox"
          checked={draft.markRead}
          onChange={event => set({ markRead: event.target.checked })}
          className="h-4 w-4 accent-[hsl(var(--rz-primary))]"
        />
        Marcar como lido
      </label>
      <label className="flex items-center gap-2 text-[13.5px] font-medium">
        <input
          type="checkbox"
          checked={draft.applyNow}
          onChange={event => set({ applyNow: event.target.checked })}
          className="h-4 w-4 accent-[hsl(var(--rz-primary))]"
        />
        Aplicar também aos emails que já estão na Entrada
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!valid || isSaving}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar regra
        </button>
      </div>
    </form>
  );
};
