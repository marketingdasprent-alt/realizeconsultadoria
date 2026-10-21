import React, { useState } from 'react';
import { ArrowLeft, Loader2, Mail, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/lib/constants';

const INPUT =
  'h-11 w-full rounded-2xl bg-rz-canvas pl-10 pr-3 text-[14px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary';

interface ForgotPasswordPanelProps {
  initialEmail: string;
  onBack: () => void;
}

/** Recuperar a palavra-passe (serve para contas de colaborador e de admin). */
export const ForgotPasswordPanel: React.FC<ForgotPasswordPanelProps> = ({
  initialEmail,
  onBack,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'form' | 'sending' | 'sent' | 'error'>('form');

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('sending');
    // Volta a este endereço (app. ou admin.). Sem "mode": a página de definir a palavra-passe
    // vê sozinha se a conta é de admin ou de colaborador.
    const { error } = await supabase.functions.invoke('recover-password', {
      body: {
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}${ROUTES.AUTH.SET_PASSWORD}`,
      },
    });
    setState(error ? 'error' : 'sent');
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rz-muted hover:text-rz-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao login
      </button>
      {state === 'sent' ? (
        <div className="space-y-3 py-4 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="text-[20px] font-extrabold">Email enviado</h1>
          <p className="text-[14px] text-rz-muted">
            Veja a caixa de correio de <strong className="text-rz-ink">{email}</strong> e siga o
            link para definir uma palavra-passe nova.
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <div>
            <h1 className="text-[22px] font-extrabold">Recuperar a palavra-passe</h1>
            <p className="mt-1 text-[14px] text-rz-muted">
              Enviamos um link para o seu email para definir uma nova.
            </p>
          </div>
          <label className="relative block">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="o.seu@email.pt"
              className={INPUT}
              disabled={state === 'sending'}
              aria-label="Email"
            />
          </label>
          {state === 'error' && (
            <p className="text-[13px] font-medium text-rose-600">
              Não foi possível enviar. Confirme o email e tente outra vez.
            </p>
          )}
          <button
            type="submit"
            disabled={state === 'sending'}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-bold text-white disabled:opacity-60"
          >
            {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar link
          </button>
        </form>
      )}
    </div>
  );
};
