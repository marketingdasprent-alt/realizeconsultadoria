import React, { useState } from 'react';
import { Loader2, MessageSquarePlus, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PUNCH_NOTE_MAX_LENGTH } from '@/lib/timeclock';
import {
  ACTION_BUTTON_LABELS,
  ALLOWED_ACTIONS,
  type WorkdayAction,
  type WorkdayStatus,
} from '@/lib/workday';
import type { PunchPhase } from '../../hooks/usePunch';

interface WorkdayActionsProps {
  status: WorkdayStatus;
  phase: PunchPhase;
  /** Ação a ser registada agora (mostra o indicador no botão certo). */
  pendingAction: WorkdayAction | null;
  disabled?: boolean;
  /** Devolve true se ficou registado (limpa a observação). */
  onAction: (action: WorkdayAction, note: string) => Promise<boolean>;
}

const ICONS = { start: Play, pause: Pause, resume: Play, stop: Square } as const;

const BUSY_LABELS: Partial<Record<PunchPhase, string>> = {
  locating: 'A localizar…',
  sending: 'A registar…',
};

/** Botões da jornada: Iniciar dia | Pausa + Terminar dia | Retomar + Terminar dia. */
export const WorkdayActions: React.FC<WorkdayActionsProps> = ({
  status,
  phase,
  pendingAction,
  disabled = false,
  onAction,
}) => {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const isBusy = phase === 'locating' || phase === 'sending';
  const actions = ALLOWED_ACTIONS[status];

  const handle = async (action: WorkdayAction) => {
    if (await onAction(action, note)) {
      setNote('');
      setShowNote(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(action => {
          const Icon = ICONS[action];
          const isPending = isBusy && pendingAction === action;
          const primary = action === 'start' || action === 'resume';
          return (
            <Button
              key={action}
              type="button"
              variant={primary ? 'gold' : 'outline'}
              className={`h-12 text-base ${actions.length === 1 ? 'col-span-2' : ''} ${
                action === 'stop' ? 'text-destructive hover:text-destructive' : ''
              }`}
              disabled={disabled || isBusy}
              onClick={() => handle(action)}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icon className="mr-2 h-4 w-4" />
              )}
              {isPending ? BUSY_LABELS[phase] : ACTION_BUTTON_LABELS[action]}
            </Button>
          );
        })}
      </div>

      {showNote ? (
        <div className="space-y-1">
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value.slice(0, PUNCH_NOTE_MAX_LENGTH))}
            placeholder="Ex.: reunião no cliente, consulta médica…"
            rows={2}
            maxLength={PUNCH_NOTE_MAX_LENGTH}
            aria-label="Observação"
            disabled={isBusy}
          />
          <p className="text-right text-xs text-muted-foreground">
            {note.length}/{PUNCH_NOTE_MAX_LENGTH}
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowNote(true)}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> Adicionar observação
        </button>
      )}
    </div>
  );
};
