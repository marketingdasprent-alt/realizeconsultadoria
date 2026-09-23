import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ENTRY_TYPE_LABELS } from '@/lib/timeclock';
import type { PunchOutcome } from '../../hooks/usePunch';

interface PunchResultProps {
  outcome: PunchOutcome;
}

export const PunchResult: React.FC<PunchResultProps> = ({ outcome }) => {
  const entry = outcome.entry;

  if (!outcome.ok || !entry) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <XCircle className="h-6 w-6 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Ponto não registado</p>
          <p className="text-sm text-destructive/90">{outcome.message}</p>
        </div>
      </div>
    );
  }

  const flagged = entry.status === 'flagged';
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        flagged
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
          : 'border-green-300 bg-green-50 dark:bg-green-900/20'
      }`}
    >
      {flagged ? (
        <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
      ) : (
        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
      )}
      <div>
        <p className="font-semibold">
          {ENTRY_TYPE_LABELS[entry.entry_type]} às {format(new Date(entry.punched_at), 'HH:mm')}
        </p>
        <p className="text-sm text-muted-foreground">
          {entry.location_name}
          {typeof entry.distance_m === 'number' && ` · a ${Math.round(entry.distance_m)} m`}
        </p>
        {outcome.code === 'duplicate' && <p className="text-sm mt-1">{outcome.message}</p>}
        {flagged && (
          <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">
            Registado, mas ficará em revisão pela equipa de RH.
          </p>
        )}
      </div>
    </div>
  );
};
