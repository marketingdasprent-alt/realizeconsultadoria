import React, { useEffect, useRef, useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import logoRealize from '@/assets/logo-realize.png';
import { ROUTES } from '@/lib/constants';
import { AREA_HOME, parseSwitchHash } from '@/lib/account-switch';
import { accountSwitchService } from '@/modules/auth/services/accountSwitchService';

/**
 * /auth/trocar#token_hash=…&to=admin|workspace — chega do outro site (botão "Ir para…" ou
 * login com a conta da outra área): troca o código de uso único pela sessão e abre a área.
 */
const AccountSwitchPage: React.FC = () => {
  const [failed, setFailed] = useState<'invalid' | 'expired' | null>(null);
  const [loginPath, setLoginPath] = useState<string>(ROUTES.EMPLOYEE.LOGIN);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const parsed = parseSwitchHash(window.location.hash);
    // O código não fica no endereço (histórico, partilhas).
    window.history.replaceState(null, '', window.location.pathname);
    if (!parsed) {
      setFailed('invalid');
      return;
    }
    setLoginPath(parsed.to === 'admin' ? ROUTES.ADMIN.LOGIN : ROUTES.EMPLOYEE.LOGIN);
    void accountSwitchService.redeem(parsed.tokenHash).then(({ error }) => {
      // Recarrega a app: nada da sessão anterior fica em memória.
      if (!error) window.location.replace(AREA_HOME[parsed.to]);
      else setFailed('expired');
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <img src={logoRealize} alt="Realize Consultadoria" className="mb-8 h-12" />
      {failed ? (
        <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 text-center shadow-lg">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            {failed === 'invalid'
              ? 'Este link não é válido.'
              : 'Este link já foi usado ou expirou. Entre com o seu email e palavra-passe.'}
          </p>
          <a
            href={loginPath}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Entrar
          </a>
        </div>
      ) : (
        <>
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-center text-muted-foreground">A abrir…</p>
        </>
      )}
    </div>
  );
};

export default AccountSwitchPage;
