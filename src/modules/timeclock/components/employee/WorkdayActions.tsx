import React, { useState } from 'react';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PUNCH_NOTE_MAX_LENGTH } from '@/lib/timeclock';
import { cn } from '@/lib/utils';
import { getActionLabel, getAllowedActions, type Workday, type WorkdayAction } from '@/lib/workday';
import type { PunchPhase } from '../../hooks/usePunch';
import { ACTION_ICONS } from './workdayStyles';

interface WorkdayActionsProps {
  workday: Pick<Workday, 'status' | 'canContinue'>;
  phase: PunchPhase;
  /** Ação a ser registada agora (mostra o indicador no botão certo). */
  pendingAction: WorkdayAction | null;
  /** A corrigir a hora (✎): o motivo substitui a observação. */
  isCorrecting?: boolean;
  disabled?: boolean;
  /** Devolve true se ficou registado (limpa a observação). */
  onAction: (action: WorkdayAction, note: string) => Promise<boolean>;
}

const BUSY_LABELS: Partial<Record<PunchPhase, string>> = {
  locating: 'A localizar…',
  sending: 'A registar…',
};

/** Ação principal (cheia, dourada), a de saída a trabalhar (escura) e as restantes. */
const buttonStyle = (action: WorkdayAction, workday: WorkdayActionsProps['workday']) => {
  if (action === 'start' || action === 'resume') return { variant: 'gold' as const, extra: '' };
  if (action === 'stop' && workday.status === 'working') {
    return { variant: 'dark' as const, extra: '' };
  }
  return { variant: 'outline' as const, extra: 'border-gold/50 bg-background hover:bg-gold/10' };
};

/** Botões da jornada: Iniciar dia | Pausa + Terminar dia | Retomar + Terminar dia | Retomar dia. */
export const WorkdayActions: React.FC<WorkdayActionsProps> = ({
  workday,
  phase,
  pendingAction,
  isCorrecting = false,
  disabled = false,
  onAction,
}) => {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const isBusy = phase === 'locating' || phase === 'sending';
  const actions = getAllowedActions(workday);

  const handle = async (action: WorkdayAction) => {
    if (await onAction(action, note)) {
      setNote('');
      setShowNote(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(action => {
          const Icon = ACTION_ICONS[action];
          const isPending = isBusy && pendingAction === action;
          const { variant, extra } = buttonStyle(action, workday);
          return (
            <Button
              key={action}
              type="button"
              variant={variant}
              className={cn(
                'h-11 rounded-xl text-[15px] font-semibold',
                actions.length === 1 && 'col-span-2',
                extra
              )}
              disabled={disabled || isBusy}
              onClick={() => handle(action)}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Icon />}
              {isPending ? BUSY_LABELS[phase] : getActionLabel(action, workday.status)}
            </Button>
          );
        })}
      </div>

      {!isCorrecting &&
        (showNote ? (
          <div className="space-y-1">
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, PUNCH_NOTE_MAX_LENGTH))}
              placeholder="Ex.: reunião no cliente, consulta médica…"
              rows={2}
              maxLength={PUNCH_NOTE_MAX_LENGTH}
              className="rounded-xl"
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
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            onClick={() => setShowNote(true)}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> Adicionar observação
          </button>
        ))}
    </div>
  );
};
