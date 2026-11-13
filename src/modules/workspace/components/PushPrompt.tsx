import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/constants';
import { isNativeApp } from '@/lib/nativeApp';
import { cn } from '@/lib/utils';
import { useWorkspace } from '../context/workspaceContext';
import { enablePush, pushState, resyncPush, type PushState } from '../services/pushService';

const HIDDEN_KEY = 'rz.push.prompt.hiddenAt';
/** Depois de "agora não", volta a aparecer passada uma semana. */
const HIDE_FOR_MS = 7 * 24 * 3600 * 1000;

const hiddenRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(HIDDEN_KEY) ?? 0) < HIDE_FOR_MS;
  } catch {
    return false;
  }
};

/**
 * Convite para ativar as notificações neste dispositivo (mensagens, emails e avisos com a app
 * fechada), no topo da app. Desligadas: botão Ativar; iPhone sem a app instalada: como instalar;
 * bloqueadas no navegador: como desbloquear. Fechado, volta passada uma semana.
 */
export const PushPrompt: React.FC<{
  className?: string;
  /** Página de como instalar a app (iPhone); sem ela só se explica o passo. */
  installHref?: string | null;
}> = ({ className, installHref = ROUTES.PUBLIC.INSTALL }) => {
  const { user, isPreview } = useWorkspace();
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(hiddenRecently);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hidden && !isPreview) void pushState().then(setState);
  }, [hidden, isPreview]);
  // Ao abrir a app: um browser já autorizado volta a guardar a subscrição no servidor (se saiu
  // de lá, os avisos deixavam de chegar sem a pessoa saber). Uma vez por sessão iniciada.
  useEffect(() => {
    if (isPreview || isNativeApp()) return;
    void resyncPush().catch(() => undefined);
  }, [isPreview, user.userId]);

  // Na app Android o push web não existe (as notificações nativas chegam numa próxima versão).
  if (isNativeApp()) return null;
  if (hidden || isPreview || (state !== 'off' && state !== 'ios-install' && state !== 'denied'))
    return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDDEN_KEY, String(Date.now()));
    } catch {
      // sem armazenamento: fecha só nesta sessão
    }
    setHidden(true);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const next = await enablePush(user.userId);
      setState(next);
      if (next === 'on') toast({ title: 'Notificações ativas neste dispositivo' });
      else if (next === 'denied')
        toast({
          title: 'Notificações bloqueadas',
          description: 'Permita-as nas definições do site (cadeado na barra de endereço).',
          variant: 'destructive',
        });
    } catch (error: unknown) {
      toast({
        title: 'Não foi possível ativar as notificações',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 shadow-sm ring-2 ring-amber-300',
        className
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
        <BellRing className="h-6 w-6" />
      </span>
      <p className="min-w-[200px] flex-1 text-[14.5px] font-semibold leading-snug text-amber-950">
        {state === 'ios-install'
          ? 'No iPhone, os avisos só chegam com a app instalada no ecrã principal (Partilhar → "Adicionar ao ecrã principal").'
          : state === 'denied'
            ? 'Os avisos estão bloqueados neste navegador. Desbloqueie-os no cadeado da barra de endereço.'
            : 'Ative os avisos para saber logo quando chegar um email novo, mesmo com a app fechada.'}
      </p>
      {state === 'ios-install'
        ? installHref && (
            <Link
              to={installHref}
              className="inline-flex h-10 shrink-0 items-center rounded-full bg-amber-500 px-4 text-[14px] font-bold text-white hover:bg-amber-600"
            >
              Como instalar
            </Link>
          )
        : state === 'off' && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-amber-500 px-5 text-[14px] font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ativar avisos
            </button>
          )}
      <button
        type="button"
        onClick={hide}
        aria-label="Agora não"
        className="rounded-full p-1.5 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};
