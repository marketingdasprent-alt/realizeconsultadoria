// Página aberta quando o colaborador encosta o telemóvel à tag NFC:
// o sistema operativo abre o URL gravado na tag (…/ponto/nfc?t=… ou ?e=…&c=…).
// Mostra o painel da jornada com os botões do estado atual (Iniciar dia, Pausa,
// Retomar, Terminar dia); o primeiro registo leva a leitura da tag. O GPS começa
// a ser lido logo ao abrir, para o registo ser rápido.
// A rota aceita qualquer sessão: com uma conta que não é de colaborador a página
// explica e deixa trocar de conta, em vez de redirecionar e perder a leitura.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/lib/constants';
import { parseTagUrl } from '@/lib/nfc';
import { useWorkday } from '../context/useWorkday';
import { EmployeeTimeClockHeader } from '../components/employee/EmployeeTimeClockHeader';
import { NfcBrowserHint } from '../components/employee/NfcBrowserHint';
import { NfcWrongAccount } from '../components/employee/NfcWrongAccount';
import { WorkdayPanel } from '../components/employee/WorkdayPanel';

const TimeClockNfcPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user, logout } = useAuth();
  const { outcome, phase, isBusy } = useWorkday();
  const isEmployee = role === 'employee';
  const [isSwitching, setIsSwitching] = useState(false);

  // Captura a leitura uma única vez e retira-a do URL/histórico do browser,
  // para que o token não fique guardado no telemóvel para reutilização.
  const [payload] = useState(() =>
    parseTagUrl(`${window.location.origin}${location.pathname}${location.search}`)
  );
  // Guardado em memória para regressar a esta leitura depois de trocar de conta.
  const [tagSearch] = useState(() => location.search);
  const wrongAccount = !isEmployee || outcome?.code === 'not_employee';

  // Com conta errada mantém a leitura no URL: ao sair, o login regressa a ela.
  useEffect(() => {
    if (location.search && isEmployee) navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate, isEmployee]);

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
      <EmployeeTimeClockHeader subtitle="Registar Ponto · tag NFC" />
      <main className="container mx-auto px-4 py-8 max-w-md">
        <Card className="rounded-3xl shadow-card">
          <CardContent className="p-3 sm:p-4 space-y-3">
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
            ) : (
              <WorkdayPanel tag={payload} />
            )}

            {payload && !wrongAccount && phase === 'done' && (
              <NfcBrowserHint isRegistered={!!outcome?.ok} />
            )}
            {!wrongAccount && (
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
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
