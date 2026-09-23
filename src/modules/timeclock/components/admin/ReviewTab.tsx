import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FLAG_INFO, getFlagLabel } from '@/lib/timeclock';
import { useTimeClockReview } from '../../hooks/useTimeClockReview';
import { AttemptsTable } from './AttemptsTable';
import { EntryChip } from './EntryChip';
import { EntryDialogs, type EntryDialogState } from './EntryDialogs';

interface ReviewTabProps {
  canEdit: boolean;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({ canEdit }) => {
  const { flagged, attempts, isLoading, error, refetch } = useTimeClockReview();
  const [dialog, setDialog] = useState<EntryDialogState | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Registos em revisão ({flagged.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aceites, mas com sinais suspeitos (VPN, IP longe do local, GPS com precisão irreal,
            coordenadas repetidas, dispositivo partilhado...). Confirme ou anule.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {flagged.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nada para rever.</p>
          )}
          {flagged.map(entry => (
            <div
              key={entry.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
            >
              <span className="font-medium sm:w-48">{entry.employee?.name}</span>
              <EntryChip
                entry={entry}
                canEdit={canEdit}
                showDate
                onAction={(mode, e) => setDialog({ mode, entry: e })}
              />
              <div className="flex flex-wrap gap-1 sm:ml-auto">
                {entry.flags
                  .filter(flag => FLAG_INFO[flag]?.warning)
                  .map(flag => (
                    <Badge key={flag} variant="destructive" className="text-xs">
                      {getFlagLabel(flag)}
                    </Badge>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tentativas rejeitadas (últimos 30 dias)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Registos recusados pelo servidor. Muitas tentativas fora do raio ou com tag inválida do
            mesmo colaborador merecem atenção.
          </p>
        </CardHeader>
        <CardContent>
          <AttemptsTable attempts={attempts} />
        </CardContent>
      </Card>

      <EntryDialogs
        state={dialog}
        employees={[]}
        onClose={() => setDialog(null)}
        onChanged={refetch}
      />
    </div>
  );
};
