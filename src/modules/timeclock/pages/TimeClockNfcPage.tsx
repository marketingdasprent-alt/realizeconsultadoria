// Página aberta quando o colaborador encosta o telemóvel à tag NFC:
// o sistema operativo abre o URL gravado na tag (…/ponto/nfc?t=… ou ?e=…&c=…)
// e o ponto é registado automaticamente após validar a localização.
// A rota aceita qualquer sessão: com uma conta que não é de colaborador a página
// explica e deixa trocar de conta, em vez de redirecionar e perder a leitura.
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Nfc, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/lib/constants';
import { parseTagUrl } from '@/lib/nfc';
import { usePunch } from '../hooks/usePunch';
import { EmployeeTimeClockHeader } from '../components/employee/EmployeeTimeClockHeader';
import { NfcBrowserHint } from '../components/employee/NfcBrowserHint';
import { NfcWrongAccount } from '../components/employee/NfcWrongAccount';
import { PunchResult } from '../components/employee/PunchResult';

const PHASE_LABELS: Record<string, string> = {
  idle: 'A preparar...',
  locating: 'A confirmar a sua localização...',
  sending: 'A registar o ponto...',
};

const TimeClockNfcPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { phase, outcome, isBusy, punch, requestRemote, swap } = usePunch();
  const { role, user, logout } = useAuth();
  const started = useRef(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Captura a leitura uma única vez e retira-a do URL/histórico do browser,
  // para que o token não fique guardado no telemóvel para reutilização.
  const [payload] = useState(() =>
    parseTagUrl(`${window.location.origin}${location.pathname}${location.search}`)
  );
  // Guardado em memória para regressar a esta leitura depois de trocar de conta.
  const [tagSearch] = useState(() => location.search);
  const wrongAccount = role !== 'employee' || outcome?.code === 'not_employee';

  // Com conta errada mantém a leitura no URL: ao sair, o login regressa a ela.
  useEffect(() => {
    if (location.search && role === 'employee') navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate, role]);

  useEffect(() => {
    if (!payload || started.current || role !== 'employee') return;
    started.current = true;
    punch('nfc', payload);
  }, [payload, punch, role]);

  const switchAccount = async () => {
    setIsSwitching(true);
    await logout();
    navigate(ROUTES.EMPLOYEE.LOGIN, {
      replace: true,
      state: { from: { pathname: ROUTES.EMPLOYEE.TIMECLOCK_NFC, search: tagSearch } },
    });
  };

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
            ) : wrongAccount ? (
              <NfcWrongAccount
                email={user?.email ?? null}
                isSwitching={isSwitching}
                onSwitch={switchAccount}
              />
            ) : isBusy || phase === 'idle' ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Nfc className="h-10 w-10 text-gold" />
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
                <p className="text-sm text-muted-foreground">{PHASE_LABELS[phase]}</p>
              </div>
            ) : (
              outcome && (
                <PunchResult
                  outcome={outcome}
                  isBusy={isBusy}
                  onRequestRemote={note => requestRemote(note)}
                  onSwap={swap}
                />
              )
            )}

            {phase === 'error' && payload && !wrongAccount && !outcome?.canRequestRemote && (
              <Button variant="outline" className="w-full" onClick={() => punch('nfc', payload)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            )}
            {payload && !wrongAccount && !isBusy && phase !== 'idle' && (
              <NfcBrowserHint isRegistered={phase === 'success'} />
            )}
            {!wrongAccount && (
              <Button
                variant="gold"
                className="w-full"
                disabled={isBusy}
                onClick={() => navigate(ROUTES.EMPLOYEE.TIMECLOCK, { replace: true })}
              >
                Ver o meu ponto
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TimeClockNfcPage;
