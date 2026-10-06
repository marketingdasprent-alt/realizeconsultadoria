import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, type TimeClockEntryWithRelations } from '@/lib/timeclock';
import { timeClockService } from '../../services/timeClockService';
import type { EntryDialogMode } from './EntryChip';
import { RejectReasonDialog } from './RejectReasonDialog';
import { ReviewEntryRow } from './ReviewEntryRow';

interface ReviewEntriesCardProps {
  title: string;
  description: string;
  emptyMessage: string;
  approveLabel: string;
  entries: TimeClockEntryWithRelations[];
  canEdit: boolean;
  ownEmployeeId: string | null;
  onAction: (mode: EntryDialogMode, entry: TimeClockEntryWithRelations) => void;
  onChanged: () => void;
}

/** Lista de registos a decidir, com aprovação/rejeição individual ou em lote. */
export const ReviewEntriesCard: React.FC<ReviewEntriesCardProps> = ({
  title,
  description,
  emptyMessage,
  approveLabel,
  entries,
  canEdit,
  ownEmployeeId,
  onAction,
  onChanged,
}) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectable = useMemo(
    () => entries.filter(e => e.employee_id !== ownEmployeeId).map(e => e.id),
    [entries, ownEmployeeId]
  );

  // Ao recarregar, mantém só as seleções que ainda existem.
  useEffect(() => {
    setSelected(current => new Set([...current].filter(id => selectable.includes(id))));
  }, [selectable]);

  const toggle = (id: string, checked: boolean) =>
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const decide = async (ids: string[], decision: 'approve' | 'reject', reason?: string) => {
    setIsBusy(true);
    const { count, error } = await timeClockService.review(ids, decision, reason);
    setIsBusy(false);
    if (error) {
      toast({
        title: 'Erro',
        description: getErrorMessage(error, 'Não foi possível atualizar os registos'),
        variant: 'destructive',
      });
      return;
    }
    const word = decision === 'approve' ? 'aprovado' : 'rejeitado';
    toast({ title: count === 1 ? `1 registo ${word}` : `${count} registos ${word}s` });
    setSelected(new Set());
    setRejecting(null);
    onChanged();
  };

  const allSelected = selectable.length > 0 && selected.size === selectable.length;
  const ids = [...selected];

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {title} ({entries.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>
        )}

        {canEdit && selectable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={v => setSelected(v === true ? new Set(selectable) : new Set())}
              aria-label="Selecionar todos"
            />
            <span>{selected.size > 0 ? `${selected.size} selecionados` : 'Selecionar todos'}</span>
            {selected.size > 0 && (
              <div className="ml-auto flex gap-2">
                <Button size="sm" disabled={isBusy} onClick={() => decide(ids, 'approve')}>
                  <Check className="h-4 w-4 mr-1" /> {approveLabel} ({selected.size})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isBusy}
                  onClick={() => setRejecting(ids)}
                >
                  <X className="h-4 w-4 mr-1" /> Rejeitar ({selected.size})
                </Button>
              </div>
            )}
          </div>
        )}

        {entries.map(entry => (
          <ReviewEntryRow
            key={entry.id}
            entry={entry}
            canEdit={canEdit}
            isOwn={entry.employee_id === ownEmployeeId}
            isSelected={selected.has(entry.id)}
            isBusy={isBusy}
            approveLabel={approveLabel}
            onToggle={checked => toggle(entry.id, checked)}
            onApprove={() => decide([entry.id], 'approve')}
            onReject={() => setRejecting([entry.id])}
            onAction={onAction}
          />
        ))}
      </CardContent>

      {rejecting && (
        <RejectReasonDialog
          count={rejecting.length}
          title="Rejeitar registos"
          onClose={() => setRejecting(null)}
          onConfirm={reason => decide(rejecting, 'reject', reason)}
        />
      )}
    </Card>
  );
};
