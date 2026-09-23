import React from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  History,
  Info,
  MapPin,
  Nfc,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Ban,
  UserCog,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENTRY_TYPE_LABELS, type TimeClockEntryWithRelations } from '@/lib/timeclock';

export type EntryDialogMode =
  | 'details'
  | 'history'
  | 'edit'
  | 'void'
  | 'restore'
  | 'review'
  | 'create';

interface EntryChipProps {
  entry: TimeClockEntryWithRelations;
  canEdit: boolean;
  showDate?: boolean;
  onAction: (mode: EntryDialogMode, entry: TimeClockEntryWithRelations) => void;
}

const SOURCE_ICONS = { nfc: Nfc, gps: MapPin, admin: UserCog } as const;

export const EntryChip: React.FC<EntryChipProps> = ({
  entry,
  canEdit,
  showDate = false,
  onAction,
}) => {
  const SourceIcon = SOURCE_ICONS[entry.source as keyof typeof SOURCE_ICONS] ?? MapPin;
  const isVoided = entry.status === 'voided';
  const tone = isVoided
    ? 'border-dashed text-muted-foreground line-through'
    : entry.status === 'flagged'
      ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
      : entry.entry_type === 'in'
        ? 'border-green-300 bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-200'
        : 'border-slate-300 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-200';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${tone}`}
        >
          <SourceIcon className="h-3 w-3" />
          {ENTRY_TYPE_LABELS[entry.entry_type]}{' '}
          {format(new Date(entry.punched_at), showDate ? 'dd/MM HH:mm' : 'HH:mm')}
          {entry.status === 'flagged' && <AlertTriangle className="h-3 w-3" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => onAction('details', entry)}>
          <Info className="h-4 w-4 mr-2" /> Detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('history', entry)}>
          <History className="h-4 w-4 mr-2" /> Histórico
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            {!isVoided && (
              <DropdownMenuItem onClick={() => onAction('edit', entry)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {entry.status === 'flagged' && (
              <DropdownMenuItem onClick={() => onAction('review', entry)}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Marcar como revisto
              </DropdownMenuItem>
            )}
            {isVoided ? (
              <DropdownMenuItem onClick={() => onAction('restore', entry)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onAction('void', entry)}
              >
                <Ban className="h-4 w-4 mr-2" /> Anular
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
