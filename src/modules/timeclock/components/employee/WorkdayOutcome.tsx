import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { ACTION_DONE_LABELS, getEntryAction, getPendingReason, getPendingTip } from '@/lib/workday';
import type { PunchOutcome } from '../../hooks/usePunch';
import { WorkdayUndoButton } from './WorkdayUndoButton';

interface WorkdayOutcomeProps {
  outcome: PunchOutcome;
  onUndo: () => Promise<string | null>;
}

const STYLES = {
  valid: {
    box: 'border-green-300 bg-green-50 dark:bg-green-900/20',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />,
  },
  flagged: {
    box: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
    icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />,
  },
  pending: {
    box: 'border-sky-300 bg-sky-50 dark:bg-sky-900/20',
    icon: <Clock className="h-5 w-5 shrink-0 text-sky-600" />,
  },
};

/** Resultado do último registo: feito, a aguardar aprovação (com o porquê) ou erro. */
export const WorkdayOutcome: React.FC<WorkdayOutcomeProps> = ({ outcome, onUndo }) => {
  const entry = outcome.entry;

  if (!outcome.ok || !entry) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <XCircle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="text-sm">
          <p className="font-medium text-destructive">Não registado</p>
          <p className="text-destructive/90">{outcome.message}</p>
        </div>
      </div>
    );
  }

  const status = entry.status === 'pending' || entry.status === 'flagged' ? entry.status : 'valid';
  const style = STYLES[status];
  const tip = status === 'pending' ? getPendingTip(entry.flags) : null;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${style.box}`}>
      {style.icon}
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {ACTION_DONE_LABELS[getEntryAction(entry)]} às{' '}
          {format(new Date(entry.punched_at), 'HH:mm')}
        </p>
        {outcome.code === 'duplicate' && <p>{outcome.message}</p>}
        {status === 'valid' && entry.location_name && (
          <p className="text-muted-foreground">{entry.location_name}</p>
        )}
        {status === 'pending' && (
          <>
            <p className="text-sky-900 dark:text-sky-200">
              Ficou registado e aguarda aprovação dos RH.{' '}
              {getPendingReason(entry.flags, outcome.distanceM, outcome.locationName)}
            </p>
            {tip && <p className="mt-1 text-xs text-muted-foreground">{tip}</p>}
          </>
        )}
        {status === 'flagged' && (
          <p className="text-amber-800 dark:text-amber-300">
            Ficou registado; vai ser revisto pela equipa de RH.
          </p>
        )}
        {outcome.code !== 'duplicate' && <WorkdayUndoButton key={entry.id} onUndo={onUndo} />}
      </div>
    </div>
  );
};
