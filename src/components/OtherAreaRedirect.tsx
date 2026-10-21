import React, { useEffect, useRef, useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { SwitchTarget } from '@/lib/account-switch';
import { accountSwitchService } from '@/modules/auth/services/accountSwitchService';

const LABELS: Record<SwitchTarget, string> = { admin: 'o admin', workspace: 'o Workspace' };

/**
 * A área desta conta está no outro endereço (login único): leva a sessão para lá. Se não
 * der, deixa terminar a sessão em vez de ficar à espera.
 */
export const OtherAreaRedirect: React.FC<{ to: SwitchTarget }> = ({ to }) => {
  const { logout } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void accountSwitchService.open(to).then(result => setError(result.error));
  }, [to]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {error ? (
        <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 text-center shadow-lg">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Terminar sessão
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A abrir {LABELS[to]}…</p>
        </div>
      )}
    </div>
  );
};
