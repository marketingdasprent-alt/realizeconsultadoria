import React from 'react';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import type { EntryDialogMode } from './EntryChip';
import { EntryDetailsDialog } from './EntryDetailsDialog';
import { EntryFormDialog } from './EntryFormDialog';
import { EntryHistoryDialog } from './EntryHistoryDialog';
import { EntryStatusDialog } from './EntryStatusDialog';

export interface EntryDialogState {
  mode: EntryDialogMode;
  entry: TimeClockEntryWithRelations | null;
}

interface EntryDialogsProps {
  state: EntryDialogState | null;
  employees: Array<{ id: string; name: string }>;
  defaultEmployeeId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Renderiza o diálogo ativo (um de cada vez) para um registo de ponto. */
export const EntryDialogs: React.FC<EntryDialogsProps> = ({
  state,
  employees,
  defaultEmployeeId,
  onClose,
  onChanged,
}) => {
  if (!state) return null;
  const { mode, entry } = state;
  const handleSaved = () => {
    onClose();
    onChanged();
  };

  if (mode === 'create') {
    return (
      <EntryFormDialog
        employees={employees}
        defaultEmployeeId={defaultEmployeeId}
        onClose={onClose}
        onSaved={handleSaved}
      />
    );
  }
  if (!entry) return null;
  if (mode === 'edit') {
    return (
      <EntryFormDialog
        entry={entry}
        employees={employees}
        onClose={onClose}
        onSaved={handleSaved}
      />
    );
  }
  if (mode === 'details') return <EntryDetailsDialog entry={entry} onClose={onClose} />;
  if (mode === 'history') return <EntryHistoryDialog entry={entry} onClose={onClose} />;
  return <EntryStatusDialog entry={entry} mode={mode} onClose={onClose} onSaved={handleSaved} />;
};
