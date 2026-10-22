import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PUNCH_NOTE_MAX_LENGTH } from '@/lib/timeclock';

export interface CorrectionValue {
  time: string;
  reason: string;
}

interface WorkdayCorrectionProps {
  value: CorrectionValue;
  onChange: (value: CorrectionValue) => void;
  error: string | null;
  disabled?: boolean;
}

/**
 * Lápis ✎ (como no Bitrix24): esqueceu-se de registar → indica a hora e o motivo; o
 * botão escolhido a seguir regista com essa hora e os RH confirmam.
 */
export const WorkdayCorrection: React.FC<WorkdayCorrectionProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => (
  <div className="space-y-2 rounded-xl bg-background p-3 ring-1 ring-border/70">
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor="workday-correction-time"
        className="whitespace-nowrap text-[13px] font-medium"
      >
        Esqueceu-se de registar?
      </label>
      <Input
        id="workday-correction-time"
        type="time"
        value={value.time}
        onChange={e => onChange({ ...value, time: e.target.value })}
        className="h-9 w-[6.75rem] shrink-0 rounded-lg px-2 tabular-nums"
        aria-label="Hora do registo"
        disabled={disabled}
      />
    </div>
    <Textarea
      value={value.reason}
      onChange={e => onChange({ ...value, reason: e.target.value.slice(0, PUNCH_NOTE_MAX_LENGTH) })}
      placeholder="Motivo (ex.: esqueci-me de registar o regresso do almoço)"
      rows={2}
      maxLength={PUNCH_NOTE_MAX_LENGTH}
      className="rounded-lg"
      aria-label="Motivo da correção"
      disabled={disabled}
    />
    {error ? (
      <p className="text-xs text-destructive" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">
        Escolha o registo abaixo. Fica registado com o motivo, visível nos RH.
      </p>
    )}
  </div>
);
