import React from 'react';
import { format } from 'date-fns';
import { Loader2, MapPin, Nfc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ENTRY_TYPE_LABELS, type EntryType, type TimeClockEntry } from '@/lib/timeclock';
import { usePunch } from '../../hooks/usePunch';
import { PunchResult } from './PunchResult';

interface PunchPanelProps {
  lastEntry: TimeClockEntry | null;
  nextType: EntryType;
  onPunched: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  locating: 'A obter a sua localização...',
  sending: 'A validar o registo...',
};

/**
 * Registo manual na app (só localização). O registo por tag NFC faz-se
 * encostando o telemóvel à tag com a app fechada (abre /ponto/nfc).
 */
export const PunchPanel: React.FC<PunchPanelProps> = ({ lastEntry, nextType, onPunched }) => {
  const { phase, outcome, isBusy, punch } = usePunch();

  const handlePunch = async () => {
    const result = await punch('gps', undefined, nextType);
    if (result?.ok) onPunched();
  };

  const isIn = lastEntry?.entry_type === 'in' && nextType === 'out';

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg lg:text-xl">Registar Ponto</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isIn && lastEntry
            ? `Entrada registada às ${format(new Date(lastEntry.punched_at), 'HH:mm')}. Próximo: Saída.`
            : 'Ainda sem entrada em curso. Próximo: Entrada.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg bg-secondary p-3 text-sm">
          <Nfc className="h-5 w-5 shrink-0 text-gold" />
          <p>
            No local de trabalho, <strong>encoste o telemóvel à tag</strong> — o ponto é registado
            automaticamente, sem abrir a app.
          </p>
        </div>

        <Button
          variant="gold"
          className="h-14 w-full text-base"
          disabled={isBusy}
          onClick={handlePunch}
        >
          <MapPin className="h-5 w-5 mr-2" />
          Registar {ENTRY_TYPE_LABELS[nextType]} manualmente
        </Button>
        <p className="text-xs text-muted-foreground">
          O registo manual só é aceite dentro do raio do local de trabalho.
        </p>

        {isBusy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {PHASE_LABELS[phase]}
          </div>
        )}
        {outcome && !isBusy && <PunchResult outcome={outcome} />}
      </CardContent>
    </Card>
  );
};
