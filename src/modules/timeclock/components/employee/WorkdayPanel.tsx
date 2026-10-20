import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Nfc } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import type { TagPayload } from '@/lib/nfc';
import { buildCorrection, type WorkdayAction } from '@/lib/workday';
import { useWorkday } from '../../context/useWorkday';
import { WorkdayActions } from './WorkdayActions';
import { WorkdayCorrection, type CorrectionValue } from './WorkdayCorrection';
import { LocationPermissionHint } from './LocationPermissionHint';
import { WorkdayError } from './WorkdayError';
import { WorkdayStatusLine } from './WorkdayStatusLine';
import { WorkdayTimeline } from './WorkdayTimeline';

interface WorkdayPanelProps {
  /** Leitura da tag NFC (página da tag): o primeiro registo usa-a. */
  tag?: TagPayload | null;
  /** Seta › para a página do ponto (no relógio do cabeçalho). */
  showPageLink?: boolean;
  /** Chamado antes de navegar (ex.: fechar o popover). */
  onNavigate?: () => void;
  /** Sem a lista de registos do dia (menu do perfil). */
  hideTimeline?: boolean;
}

const EMPTY_CORRECTION: CorrectionValue = { time: '', reason: '' };

/**
 * Painel da jornada como no Bitrix24: estado com cronómetro e lápis ✎ (registo
 * esquecido), botões Iniciar dia / Pausa / Retomar / Terminar dia / Retomar dia e
 * os registos do dia com o sítio de cada um.
 */
export const WorkdayPanel: React.FC<WorkdayPanelProps> = ({
  tag,
  showPageLink,
  onNavigate,
  hideTimeline = false,
}) => {
  const navigate = useNavigate();
  const { employee, isLoading, entries, workday, phase, outcome, run, warmUp } = useWorkday();
  const [pendingAction, setPendingAction] = useState<WorkdayAction | null>(null);
  const [isTagUsed, setIsTagUsed] = useState(false);
  const [correction, setCorrection] = useState<CorrectionValue | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const withTag = !!tag && !isTagUsed;

  // Começa já a ler o GPS: quando carregar no botão, a localização está pronta.
  useEffect(() => {
    if (employee) warmUp();
  }, [employee, warmUp]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!employee) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Esta conta não está associada a um colaborador.
      </p>
    );
  }

  const toggleCorrection = () => {
    setCorrection(current => (current ? null : EMPTY_CORRECTION));
    setCorrectionError(null);
  };

  const handleAction = async (action: WorkdayAction, note: string) => {
    let at: string | undefined;
    if (correction) {
      const built = buildCorrection(correction.time, correction.reason, workday.last);
      if ('error' in built) {
        setCorrectionError(built.error);
        return false;
      }
      at = built.at;
    }
    setPendingAction(action);
    const result = await run(action, {
      note: correction ? correction.reason : note,
      method: withTag ? 'nfc' : 'gps',
      tag: withTag ? (tag ?? undefined) : undefined,
      ...(at ? { at } : {}),
    });
    if (!result?.ok) return false;
    // A leitura da tag vale para um registo; os seguintes são feitos pela app.
    if (withTag) setIsTagUsed(true);
    setCorrection(null);
    return true;
  };

  const openPage = () => {
    onNavigate?.();
    navigate(ROUTES.EMPLOYEE.TIMECLOCK);
  };

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-2xl bg-secondary p-4 ring-1 ring-border/60">
        <WorkdayStatusLine
          entries={entries}
          onEdit={toggleCorrection}
          isEditing={!!correction}
          onOpenPage={showPageLink ? openPage : undefined}
        />
        {withTag && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Nfc className="h-4 w-4 text-gold" /> Tag lida. Escolha o registo:
          </p>
        )}
        {correction && (
          <WorkdayCorrection
            value={correction}
            onChange={value => {
              setCorrection(value);
              setCorrectionError(null);
            }}
            error={correctionError}
            disabled={phase === 'locating' || phase === 'sending'}
          />
        )}
        <WorkdayActions
          workday={workday}
          phase={phase}
          pendingAction={pendingAction}
          isCorrecting={!!correction}
          onAction={handleAction}
        />
        {outcome && !outcome.ok && phase === 'done' && <WorkdayError message={outcome.message} />}
        <LocationPermissionHint refreshKey={outcome} />
      </section>
      {!hideTimeline && <WorkdayTimeline entries={workday.entries} />}
    </div>
  );
};
