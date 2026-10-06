import React from 'react';
import { Check, House, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FLAG_INFO,
  formatDistance,
  getFlagLabel,
  type TimeClockEntryWithRelations,
} from '@/lib/timeclock';
import { EntryChip, type EntryDialogMode } from './EntryChip';

interface ReviewEntryRowProps {
  entry: TimeClockEntryWithRelations;
  canEdit: boolean;
  /** Registo do próprio administrador: não pode ser decidido por ele. */
  isOwn: boolean;
  isSelected: boolean;
  isBusy: boolean;
  approveLabel: string;
  onToggle: (checked: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onAction: (mode: EntryDialogMode, entry: TimeClockEntryWithRelations) => void;
}

export const ReviewEntryRow: React.FC<ReviewEntryRowProps> = ({
  entry,
  canEdit,
  isOwn,
  isSelected,
  isBusy,
  approveLabel,
  onToggle,
  onApprove,
  onReject,
  onAction,
}) => {
  const canDecide = canEdit && !isOwn;
  const warnings = entry.flags.filter(flag => FLAG_INFO[flag]?.warning);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 lg:flex-row lg:items-center">
      <div className="flex items-center gap-3 lg:w-56">
        {canEdit && (
          <Checkbox
            checked={isSelected}
            disabled={!canDecide}
            onCheckedChange={v => onToggle(v === true)}
            aria-label={`Selecionar registo de ${entry.employee?.name ?? 'colaborador'}`}
          />
        )}
        <span className="font-medium">{entry.employee?.name}</span>
      </div>
      <EntryChip entry={entry} canEdit={canEdit} showDate onAction={onAction} />

      <div className="flex flex-1 flex-col gap-1 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {entry.work_mode === 'remote' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <House className="h-3 w-3" /> Remoto
              {typeof entry.distance_m === 'number' &&
                ` · a ${formatDistance(entry.distance_m)} do local`}
            </Badge>
          )}
          {warnings.map(flag => (
            <Badge key={flag} variant="destructive" className="text-xs">
              {getFlagLabel(flag)}
            </Badge>
          ))}
        </div>
        {entry.employee_note && (
          <p className="text-muted-foreground italic">“{entry.employee_note}”</p>
        )}
        {isOwn && (
          <p className="text-xs text-muted-foreground">
            É o seu registo — tem de ser decidido por outro administrador.
          </p>
        )}
      </div>

      {canDecide && (
        <div className="flex gap-2 lg:ml-auto">
          <Button size="sm" variant="outline" disabled={isBusy} onClick={onApprove}>
            <Check className="h-4 w-4 mr-1 text-green-600" /> {approveLabel}
          </Button>
          <Button size="sm" variant="outline" disabled={isBusy} onClick={onReject}>
            <X className="h-4 w-4 mr-1 text-destructive" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
};
