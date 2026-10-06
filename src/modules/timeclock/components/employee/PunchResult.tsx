import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, House, XCircle } from 'lucide-react';
import { ENTRY_TYPE_LABELS, formatDistance } from '@/lib/timeclock';
import type { PunchOutcome } from '../../hooks/usePunch';
import { RemotePunchPrompt } from './RemotePunchPrompt';
import { SwapEntryButton } from './SwapEntryButton';

interface PunchResultProps {
  outcome: PunchOutcome;
  isBusy?: boolean;
  /** Repetir o registo recusado como trabalho remoto. */
  onRequestRemote?: (note: string) => void;
  /** Trocar Entrada↔Saída do registo acabado de fazer. */
  onSwap?: () => Promise<string | null>;
}

const STATUS_STYLES = {
  valid: {
    box: 'border-green-300 bg-green-50 dark:bg-green-900/20',
    icon: <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />,
  },
  flagged: {
    box: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
    icon: <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />,
  },
  pending: {
    box: 'border-sky-300 bg-sky-50 dark:bg-sky-900/20',
    icon: <House className="h-6 w-6 shrink-0 text-sky-600" />,
  },
};

export const PunchResult: React.FC<PunchResultProps> = ({
  outcome,
  isBusy = false,
  onRequestRemote,
  onSwap,
}) => {
  const entry = outcome.entry;

  if (!outcome.ok || !entry) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <XCircle className="h-6 w-6 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Ponto não registado</p>
            <p className="text-sm text-destructive/90">{outcome.message}</p>
          </div>
        </div>
        {outcome.canRequestRemote && onRequestRemote && (
          <RemotePunchPrompt
            distanceM={outcome.distanceM}
            locationName={outcome.locationName}
            isBusy={isBusy}
            onConfirm={onRequestRemote}
          />
        )}
      </div>
    );
  }

  const status = entry.status === 'pending' || entry.status === 'flagged' ? entry.status : 'valid';
  const style = STATUS_STYLES[status];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${style.box}`}>
      {style.icon}
      <div>
        <p className="font-semibold">
          {ENTRY_TYPE_LABELS[entry.entry_type]} às {format(new Date(entry.punched_at), 'HH:mm')}
        </p>
        <p className="text-sm text-muted-foreground">
          {entry.location_name}
          {typeof entry.distance_m === 'number' && ` · a ${formatDistance(entry.distance_m)}`}
        </p>
        {outcome.code === 'duplicate' && <p className="text-sm mt-1">{outcome.message}</p>}
        {status === 'pending' && (
          <p className="text-sm mt-1 text-sky-800 dark:text-sky-300">
            Trabalho remoto: fica a aguardar aprovação dos RH. Se for rejeitado, deixa de contar.
          </p>
        )}
        {status === 'flagged' && (
          <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">
            Registado, mas ficará em revisão pela equipa de RH.
          </p>
        )}
        {onSwap && (
          <SwapEntryButton entryId={entry.id} entryType={entry.entry_type} onSwap={onSwap} />
        )}
      </div>
    </div>
  );
};
