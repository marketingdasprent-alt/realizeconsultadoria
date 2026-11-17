import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MfaCodeForm } from './MfaCodeForm';
import { mfaErrorMessage, needsChallenge } from '../lib/mfa';
import { mfaService } from '../services/mfaService';

/**
 * Quem ativou a confirmação em dois passos tem de a fazer em cada entrada: depois da
 * palavra-passe, e antes de ver qualquer ecrã, pede-se o código da app. Se não for possível
 * saber (rede), deixa passar: o servidor é que decide o que cada sessão pode ler.
 */
export const MfaGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<'checking' | 'open' | 'challenge'>('checking');
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const levels = await mfaService.levels();
        if (!needsChallenge(levels)) return alive && setState('open');
        const { active } = await mfaService.status();
        if (!alive) return;
        if (!active) return setState('open');
        setFactorId(active.id);
        setState('challenge');
      } catch {
        if (alive) setState('open');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'open') return <>{children}</>;
  if (state === 'checking')
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="A verificar a sessão"
      >
        <Loader2 className="h-8 w-8 animate-spin text-rz-primary" />
      </div>
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-rz-canvas p-4">
      <section className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-rz-pop ring-1 ring-rz-line">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft text-rz-primary">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[22px] font-extrabold">Confirme a sua entrada</h1>
        <p className="mt-1 text-[14px] text-rz-muted">
          Abra a app de autenticação no telemóvel e introduza o código de 6 dígitos da Realize.
        </p>
        <MfaCodeForm
          className="mt-5"
          submitLabel="Entrar"
          onSubmit={async code => {
            try {
              await mfaService.verify(factorId as string, code);
              setState('open');
              return null;
            } catch (error) {
              return mfaErrorMessage(error);
            }
          }}
        >
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="h-11 rounded-full px-4 text-[14px] font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Terminar sessão
          </button>
        </MfaCodeForm>
        <p className="mt-4 text-[12.5px] text-rz-muted">
          Perdeu o acesso à app? Peça à equipa da Realize para repor a confirmação da sua conta.
        </p>
      </section>
    </main>
  );
};
