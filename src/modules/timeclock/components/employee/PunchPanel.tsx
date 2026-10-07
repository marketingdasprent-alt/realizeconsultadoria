import React, { useState } from 'react';
import { Clock, Loader2, Nfc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TimeClockEntry } from '@/lib/timeclock';
import { usePunch, type PunchChoice } from '../../hooks/usePunch';
import { PunchForm } from './PunchForm';
import { PunchResult } from './PunchResult';

interface PunchPanelProps {
  lastEntry: TimeClockEntry | null;
  onPunched: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  locating: 'A obter a sua localização...',
  sending: 'A validar o registo...',
};

/**
 * Registo manual na app: "Registar Ponto" abre o formulário (Entrada/Saída,
 * observações e confirmação). Com tag, encosta-se o telemóvel com a app fechada
 * e abre o mesmo formulário em /ponto/nfc.
 */
export const PunchPanel: React.FC<PunchPanelProps> = ({ lastEntry, onPunched }) => {
  const { phase, outcome, isBusy, lastNote, punch, warmUp, requestRemote, swap } = usePunch();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const done = (ok?: boolean) => {
    if (ok) onPunched();
  };

  const handleSubmit = async (choice: PunchChoice) => {
    setIsFormOpen(false);
    done((await punch('gps', choice))?.ok);
  };

  const handleRemote = async (note: string) => done((await requestRemote(note))?.ok);

  const handleSwap = async () => {
    const error = await swap();
    if (!error) onPunched();
    return error;
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg lg:text-xl">Registar Ponto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg bg-secondary p-3 text-sm">
          <Nfc className="h-5 w-5 shrink-0 text-gold" />
          <p>
            No local de trabalho, <strong>encoste o telemóvel à tag</strong> — abre logo o registo,
            sem abrir a app.
          </p>
        </div>

        {isFormOpen ? (
          <div className="space-y-2 rounded-lg border border-border p-4">
            <PunchForm
              lastEntry={lastEntry}
              isBusy={isBusy}
              onStart={warmUp}
              onSubmit={handleSubmit}
            />
            <Button variant="ghost" className="w-full" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="gold"
            className="h-14 w-full text-base"
            disabled={isBusy}
            onClick={() => setIsFormOpen(true)}
          >
            <Clock className="h-5 w-5 mr-2" />
            Registar Ponto
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          No local de trabalho o registo é aceite logo. Fora dele pode registar como trabalho
          remoto, que fica a aguardar aprovação.
        </p>

        {isBusy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {PHASE_LABELS[phase]}
          </div>
        )}
        {outcome && !isBusy && (
          <PunchResult
            outcome={outcome}
            isBusy={isBusy}
            note={lastNote}
            onRequestRemote={handleRemote}
            onSwap={handleSwap}
          />
        )}
      </CardContent>
    </Card>
  );
};
