import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, Nfc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import type { TagPayload } from '@/lib/nfc';
import type { WorkdayAction } from '@/lib/workday';
import { useWorkday } from '../../context/useWorkday';
import { WorkdayActions } from './WorkdayActions';
import { WorkdayOutcome } from './WorkdayOutcome';
import { WorkdayStatusLine } from './WorkdayStatusLine';
import { WorkdayTimeline } from './WorkdayTimeline';

interface WorkdayPanelProps {
  /** Leitura da tag NFC (página da tag): o primeiro registo usa-a. */
  tag?: TagPayload | null;
  /** Atalho para a página do ponto (no relógio do cabeçalho). */
  showPageLink?: boolean;
  /** Chamado antes de navegar (ex.: fechar o popover). */
  onNavigate?: () => void;
}

/**
 * Painel da jornada como no Bitrix24: estado com cronómetro, botões Iniciar dia /
 * Pausa / Retomar / Terminar dia, resultado com "Desfazer" e os registos do dia.
 */
export const WorkdayPanel: React.FC<WorkdayPanelProps> = ({ tag, showPageLink, onNavigate }) => {
  const navigate = useNavigate();
  const { employee, isLoading, entries, workday, phase, outcome, run, undo, warmUp } = useWorkday();
  const [pendingAction, setPendingAction] = useState<WorkdayAction | null>(null);
  const [isTagUsed, setIsTagUsed] = useState(false);
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

  const handleAction = async (action: WorkdayAction, note: string) => {
    setPendingAction(action);
    const result = await run(action, {
      note,
      method: withTag ? 'nfc' : 'gps',
      tag: withTag ? (tag ?? undefined) : undefined,
    });
    // A leitura da tag vale para um registo; os seguintes são feitos pela app.
    if (result?.ok && withTag) setIsTagUsed(true);
    return !!result?.ok;
  };

  return (
    <div className="space-y-4">
      <WorkdayStatusLine entries={entries} />
      {withTag && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Nfc className="h-4 w-4 text-gold" /> Tag lida. Escolha o registo:
        </p>
      )}
      <WorkdayActions
        status={workday.status}
        phase={phase}
        pendingAction={pendingAction}
        onAction={handleAction}
      />
      {outcome && phase === 'done' && <WorkdayOutcome outcome={outcome} onUndo={undo} />}
      <WorkdayTimeline entries={workday.entries} />
      {showPageLink && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-gold"
          onClick={() => {
            onNavigate?.();
            navigate(ROUTES.EMPLOYEE.TIMECLOCK);
          }}
        >
          Ver o meu ponto <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
