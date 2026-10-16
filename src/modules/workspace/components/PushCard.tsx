import React, { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '../context/workspaceContext';
import { disablePush, enablePush, pushState, type PushState } from '../services/pushService';

const HINTS: Record<PushState, string> = {
  on: 'Ativas neste dispositivo. Recebe avisos de ponto, mensagens importantes e lembretes, mesmo com a app fechada.',
  off: 'Receba os avisos (ex.: "Já registou a entrada?") mesmo com a app fechada.',
  denied:
    'Bloqueou as notificações neste browser. Para ativar, permita-as nas definições do site (cadeado na barra de endereço).',
  'ios-install':
    'No iPhone, primeiro instale a app: no Safari, toque em Partilhar → "Adicionar ao ecrã principal", abra-a a partir daí e volte aqui.',
  unsupported: 'Este browser não suporta notificações. Use o Chrome, o Edge ou a app instalada.',
};

/** Ligar/desligar as notificações push neste dispositivo. */
export const PushCard: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  const toggle = async () => {
    if (isPreview) return void toast({ title: 'Pré-visualização: sem notificações reais' });
    setBusy(true);
    try {
      const next = state === 'on' ? await disablePush() : await enablePush(user.userId);
      setState(next);
      if (next === 'on') toast({ title: 'Notificações ativas neste dispositivo' });
    } catch {
      toast({ title: 'Não foi possível ativar as notificações', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const canToggle = state === 'on' || state === 'off';
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-[16px] font-bold">Notificações no telemóvel</h2>
          <p className="text-[13px] text-rz-muted">{state ? HINTS[state] : 'A verificar…'}</p>
        </div>
      </div>
      {canToggle && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={
            state === 'on'
              ? 'mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas'
              : 'mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[14px] font-bold text-white'
          }
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === 'on' ? 'Desativar neste dispositivo' : 'Ativar notificações'}
        </button>
      )}
    </section>
  );
};
