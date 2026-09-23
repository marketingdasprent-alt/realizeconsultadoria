// Página aberta quando o colaborador encosta o telemóvel à tag NFC:
// o sistema operativo abre o URL gravado na tag (…/ponto/nfc?t=… ou ?e=…&c=…)
// e o ponto é registado automaticamente após validar a localização.
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Nfc, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants';
import { parseTagUrl } from '@/lib/nfc';
import { usePunch } from '../hooks/usePunch';
import { EmployeeTimeClockHeader } from '../components/employee/EmployeeTimeClockHeader';
import { PunchResult } from '../components/employee/PunchResult';

const PHASE_LABELS: Record<string, string> = {
  idle: 'A preparar...',
  locating: 'A confirmar a sua localização...',
  sending: 'A registar o ponto...',
};

const TimeClockNfcPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { phase, outcome, isBusy, punch } = usePunch();
  const started = useRef(false);

  // Captura a leitura uma única vez e retira-a do URL/histórico do browser,
  // para que o token não fique guardado no telemóvel para reutilização.
  const [payload] = useState(() =>
    parseTagUrl(`${window.location.origin}${location.pathname}${location.search}`)
  );

  useEffect(() => {
    if (location.search) navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!payload || started.current) return;
    started.current = true;
    punch('nfc', payload);
  }, [payload, punch]);

  return (
    <div className="min-h-screen bg-secondary">
      <EmployeeTimeClockHeader subtitle="Registo por tag NFC" />
      <main className="container mx-auto px-4 py-8 max-w-md">
        <Card className="shadow-card">
          <CardContent className="pt-6 space-y-4">
            {!payload ? (
              <p className="text-sm text-destructive">
                Este link não contém uma leitura de tag válida. Encoste novamente o telemóvel à tag.
              </p>
            ) : isBusy || phase === 'idle' ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Nfc className="h-10 w-10 text-gold" />
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
                <p className="text-sm text-muted-foreground">{PHASE_LABELS[phase]}</p>
              </div>
            ) : (
              outcome && <PunchResult outcome={outcome} />
            )}

            {phase === 'error' && payload && (
              <Button variant="outline" className="w-full" onClick={() => punch('nfc', payload)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            )}
            <Button
              variant="gold"
              className="w-full"
              disabled={isBusy}
              onClick={() => navigate(ROUTES.EMPLOYEE.TIMECLOCK, { replace: true })}
            >
              Ver o meu ponto
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TimeClockNfcPage;
