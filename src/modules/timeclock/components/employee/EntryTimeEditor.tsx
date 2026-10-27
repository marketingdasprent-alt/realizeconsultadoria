import React, { useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PUNCH_NOTE_MAX_LENGTH } from '@/lib/timeclock';

interface EntryTimeEditorProps {
  /** Hora atual do registo (ISO). */
  punchedAt: string;
  onCancel: () => void;
  /** Grava a nova hora (ISO) com o motivo; devolve a mensagem de erro, ou null. */
  onSave: (atIso: string, reason: string) => Promise<string | null>;
}

/** ✎ num registo do dia: mudar a hora (ex.: a app falhou e a entrada ficou mais tarde). */
export const EntryTimeEditor: React.FC<EntryTimeEditorProps> = ({
  punchedAt,
  onCancel,
  onSave,
}) => {
  const [time, setTime] = useState(format(new Date(punchedAt), 'HH:mm'));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) return setError('Indique a hora.');
    if (reason.trim().length < 3) return setError('Escreva o motivo da correção.');
    // O registo é do próprio dia: a hora nova fica nesse dia.
    const at = new Date(punchedAt);
    at.setHours(Number(match[1]), Number(match[2]), 0, 0);
    setSaving(true);
    const problem = await onSave(at.toISOString(), reason.trim());
    setSaving(false);
    if (problem) setError(problem);
  };

  return (
    <div className="mx-2 mb-2 space-y-2 rounded-xl bg-background p-3 ring-1 ring-border/70">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="entry-time" className="text-[13px] font-medium">
          Hora certa deste registo
        </label>
        <Input
          id="entry-time"
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="h-9 w-[6.75rem] shrink-0 rounded-lg px-2 tabular-nums"
          disabled={saving}
        />
      </div>
      <Textarea
        value={reason}
        onChange={e => setReason(e.target.value.slice(0, PUNCH_NOTE_MAX_LENGTH))}
        placeholder="Motivo (ex.: a app não funcionou e entrei às 09:10)"
        rows={2}
        maxLength={PUNCH_NOTE_MAX_LENGTH}
        className="rounded-lg"
        aria-label="Motivo da correção"
        disabled={saving}
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Fica a aguardar a confirmação dos RH.</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-full px-3 text-[13px] font-semibold text-muted-foreground hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Corrigir hora
        </button>
      </div>
    </div>
  );
};
