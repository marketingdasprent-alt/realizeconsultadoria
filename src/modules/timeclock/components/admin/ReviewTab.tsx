import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { matchesNameSearch } from '@/lib/timeclock';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import type { UseTimeClockReviewResult } from '../../hooks/useTimeClockReview';
import { ApprovalEmailsCard } from './ApprovalEmailsCard';
import { AttemptsTable } from './AttemptsTable';
import { EntryDialogs, type EntryDialogState } from './EntryDialogs';
import { NameSearchInput } from './NameSearchInput';
import { ReviewEntriesCard } from './ReviewEntriesCard';

interface ReviewTabProps {
  canEdit: boolean;
  review: UseTimeClockReviewResult;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({ canEdit, review }) => {
  const { pending, flagged, attempts, isLoading, error, refetch } = review;
  const { employee } = useCurrentEmployee();
  const [dialog, setDialog] = useState<EntryDialogState | null>(null);
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => ({
      pending: pending.filter(e => matchesNameSearch(e.employee?.name, search)),
      flagged: flagged.filter(e => matchesNameSearch(e.employee?.name, search)),
      attempts: attempts.filter(a => matchesNameSearch(a.employee?.name, search)),
    }),
    [pending, flagged, attempts, search]
  );
  const openDialog = (mode: EntryDialogState['mode'], entry: EntryDialogState['entry']) =>
    setDialog({ mode, entry });

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
      <NameSearchInput id="review-search" value={search} onChange={setSearch} className="sm:w-72" />

      <ReviewEntriesCard
        title="A aguardar aprovação"
        description="Registos feitos fora do local de trabalho (teletrabalho, cliente, deslocação). Contam provisoriamente; se forem rejeitados deixam de contar."
        emptyMessage="Nenhum registo remoto por aprovar."
        approveLabel="Aprovar"
        entries={filtered.pending}
        canEdit={canEdit}
        ownEmployeeId={employee?.id ?? null}
        onAction={openDialog}
        onChanged={refetch}
      />

      <ReviewEntriesCard
        title="Registos com alertas"
        description="Aceites, mas com sinais suspeitos (VPN, IP longe do local, GPS com precisão irreal, coordenadas repetidas, dispositivo partilhado...). Confirme ou rejeite."
        emptyMessage="Nada para rever."
        approveLabel="Confirmar"
        entries={filtered.flagged}
        canEdit={canEdit}
        ownEmployeeId={employee?.id ?? null}
        onAction={openDialog}
        onChanged={refetch}
      />

      <ApprovalEmailsCard canEdit={canEdit} />

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tentativas rejeitadas (últimos 30 dias)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Registos recusados pelo servidor. Muitas tentativas fora do raio ou com tag inválida do
            mesmo colaborador merecem atenção.
          </p>
        </CardHeader>
        <CardContent>
          <AttemptsTable attempts={filtered.attempts} />
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
