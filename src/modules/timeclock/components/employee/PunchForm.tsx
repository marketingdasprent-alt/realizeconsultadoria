import React, { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ENTRY_TYPE_LABELS, PUNCH_NOTE_MAX_LENGTH, type EntryType } from '@/lib/timeclock';
import type { PunchChoice } from '../../hooks/usePunch';

interface PunchFormProps {
  /** Último registo do colaborador, para ajudar a escolher. */
  lastEntry: { entry_type: string; punched_at: string } | null;
  isBusy: boolean;
  onSubmit: (choice: PunchChoice) => void;
  /** Chamado ao escolher o tipo: começa já a obter o GPS. */
  onStart?: () => void;
}

const whenLabel = (iso: string) => {
  const date = new Date(iso);
  const day = isToday(date) ? 'hoje' : isYesterday(date) ? 'ontem' : format(date, 'dd/MM');
  return `${day} às ${format(date, 'HH:mm')}`;
};

/**
 * Formulário de registo: o colaborador escolhe Entrada/Saída, pode deixar uma
 * observação e confirma. Escolher o tipo evita que uma picagem esquecida
 * inverta as seguintes.
 */
export const PunchForm: React.FC<PunchFormProps> = ({ lastEntry, isBusy, onSubmit, onStart }) => {
  const [entryType, setEntryType] = useState<EntryType | ''>('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const repeated = !!entryType && lastEntry?.entry_type === entryType;
  const canSubmit = !!entryType && confirmed && !isBusy;

  const choose = (value: string) => {
    setEntryType(value as EntryType);
    setConfirmed(false);
    onStart?.();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryType || !confirmed) return;
    onSubmit({ entryType, note: note.trim() || undefined });
    setEntryType('');
    setNote('');
    setConfirmed(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {lastEntry
          ? `Último registo: ${ENTRY_TYPE_LABELS[lastEntry.entry_type]} ${whenLabel(lastEntry.punched_at)}.`
          : 'Ainda não tem registos.'}
      </p>

      <div className="space-y-2">
        <Label htmlFor="punch-type">O que está a registar? *</Label>
        <Select value={entryType} onValueChange={choose}>
          <SelectTrigger id="punch-type" className="h-12 text-base">
            <SelectValue placeholder="Escolha Entrada ou Saída" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in">Entrada</SelectItem>
            <SelectItem value="out">Saída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {repeated && lastEntry && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            O seu último registo também foi <strong>{ENTRY_TYPE_LABELS[entryType]}</strong> (
            {whenLabel(lastEntry.punched_at)}). Se se esqueceu de picar, registe na mesma e explique
            nas observações — os RH corrigem a picagem em falta.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="punch-note">Observações (opcional)</Label>
        <Textarea
          id="punch-note"
          rows={2}
          maxLength={PUNCH_NOTE_MAX_LENGTH}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Ex.: esqueci-me de picar a saída do almoço às 13h"
        />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="punch-confirm"
          checked={confirmed}
          disabled={!entryType}
          onCheckedChange={v => setConfirmed(v === true)}
        />
        <Label htmlFor="punch-confirm" className="text-sm font-normal leading-snug">
          {entryType
            ? `Confirmo que quero registar a ${ENTRY_TYPE_LABELS[entryType]} agora.`
            : 'Confirmo o registo (escolha primeiro Entrada ou Saída).'}
        </Label>
      </div>

      <Button type="submit" variant="gold" className="h-12 w-full text-base" disabled={!canSubmit}>
        {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Registar
      </Button>
    </form>
  );
};
