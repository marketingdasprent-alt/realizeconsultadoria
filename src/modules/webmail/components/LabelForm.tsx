import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { useAccountFolders } from '../hooks/useAccountFolders';
import { flattenFolders } from '../lib/folderTree';
import { LABEL_STYLES, labelStyle } from '../lib/labelColors';
import { LABEL_COLORS, type LabelColor, type MailLabel } from '../types';

interface LabelFormProps {
  accountId: string;
  /** Marcador a editar; sem ele, um novo. */
  label?: MailLabel;
  /** Os outros marcadores da caixa (a automação pode tirá-los). */
  others: MailLabel[];
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (value: Pick<MailLabel, 'name' | 'color' | 'onApply'>) => void;
}

const FIELD =
  'h-10 w-full rounded-xl bg-white px-3 text-[14px] font-medium outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary';

/** Nome, cor e automação de um marcador ("quando pôr este marcador…"). */
export const LabelForm: React.FC<LabelFormProps> = ({
  accountId,
  label,
  others,
  isSaving,
  error,
  onCancel,
  onSave,
}) => {
  const folders = useAccountFolders(accountId);
  const list = flattenFolders(folders.data ?? []);
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState<LabelColor>(label?.color ?? 'blue');
  const [folderId, setFolderId] = useState(label?.onApply.folderId ?? '');
  const [markRead, setMarkRead] = useState(label?.onApply.markRead ?? false);
  const [remove, setRemove] = useState<string[]>(label?.onApply.removeLabelIds ?? []);
  const folderName = list.find(item => item.folder.id === folderId)?.folder.name ?? null;

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          color,
          onApply: {
            folderId: folderId && folderName ? folderId : null,
            folderName: folderId && folderName ? folderName : null,
            markRead,
            removeLabelIds: remove,
          },
        });
      }}
      className="space-y-3 rounded-2xl bg-rz-canvas p-3"
    >
      <input
        autoFocus
        value={name}
        onChange={event => setName(event.target.value.slice(0, 40))}
        placeholder="Nome do marcador (ex.: Por tratar)"
        aria-label="Nome do marcador"
        className={FIELD}
      />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
        {LABEL_COLORS.map(option => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={color === option}
            title={LABEL_STYLES[option].label}
            onClick={() => setColor(option)}
            className={cn(
              'h-7 w-7 rounded-full ring-offset-2 ring-offset-[hsl(var(--rz-canvas))]',
              LABEL_STYLES[option].dot,
              color === option && 'ring-2 ring-rz-ink'
            )}
          />
        ))}
      </div>

      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-rz-line">
        <p className="text-[12px] font-bold text-rz-muted">Quando puser este marcador (opcional)</p>
        <RzSelect
          value={folderId}
          onChange={setFolderId}
          placeholder="Não mudar de pasta"
          options={[
            { value: '', label: 'Não mudar de pasta' },
            ...list.map(({ folder, depth }) => ({
              value: folder.id,
              label: `Mover para: ${'— '.repeat(depth)}${folder.name}`,
            })),
          ]}
          ariaLabel="Pasta de destino"
          className="h-10 w-full rounded-xl bg-white px-3 text-[14px] ring-1 ring-rz-line"
        />
        <label className="flex items-center gap-2 text-[13.5px] font-medium">
          <input
            type="checkbox"
            checked={markRead}
            onChange={event => setMarkRead(event.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--rz-primary))]"
          />
          Marcar como lido
        </label>
        {others.length > 0 && (
          <div>
            <p className="mb-1 text-[12.5px] font-medium">Tirar estes marcadores:</p>
            <div className="flex flex-wrap gap-1.5">
              {others.map(other => {
                const checked = remove.includes(other.id);
                return (
                  <button
                    key={other.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() =>
                      setRemove(current =>
                        checked ? current.filter(id => id !== other.id) : [...current, other.id]
                      )
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1',
                      checked
                        ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary'
                        : 'bg-white text-rz-muted ring-rz-line'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', labelStyle(other.color).dot)} />
                    {other.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-rose-600">{error}</p>}
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
          disabled={!name.trim() || isSaving}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
        </button>
      </div>
    </form>
  );
};
