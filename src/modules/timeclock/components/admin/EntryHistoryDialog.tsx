import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TimeClockEntryWithRelations, TimeClockHistory } from '@/lib/timeclock';
import { timeClockService } from '../../services/timeClockService';
import { HistoryChangeList } from './HistoryChangeList';

interface EntryHistoryDialogProps {
  entry: TimeClockEntryWithRelations;
  onClose: () => void;
}

export const EntryHistoryDialog: React.FC<EntryHistoryDialogProps> = ({ entry, onClose }) => {
  const [items, setItems] = useState<TimeClockHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    timeClockService.getHistory({ entryId: entry.id }).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) setError('Erro ao carregar o histórico');
      setItems(data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico do registo</DialogTitle>
          <DialogDescription>
            {entry.employee?.name} — todas as alterações ficam aqui gravadas.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <HistoryChangeList items={items} />
        )}
      </DialogContent>
    </Dialog>
  );
};
