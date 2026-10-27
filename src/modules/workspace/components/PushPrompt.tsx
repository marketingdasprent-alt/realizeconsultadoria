import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/constants';
import { isNativeApp } from '@/lib/nativeApp';
import { cn } from '@/lib/utils';
import { useWorkspace } from '../context/workspaceContext';
import { enablePush, pushState, type PushState } from '../services/pushService';

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
export const PushPrompt: React.FC<{ className?: string }> = ({ className }) => {
  const { user, isPreview } = useWorkspace();
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(hiddenRecently);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hidden && !isPreview) void pushState().then(setState);
  }, [hidden, isPreview]);

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
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200',
        className
      )}
    >
      <BellRing className="h-5 w-5 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-amber-900">
        {state === 'ios-install'
          ? 'No iPhone, os avisos só chegam com a app instalada no ecrã principal.'
          : state === 'denied'
            ? 'Os avisos estão bloqueados neste navegador. Desbloqueie-os no cadeado da barra de endereço.'
            : 'Receba as mensagens e os emails novos mesmo com a app fechada.'}
      </p>
      {state === 'ios-install' ? (
        <Link
          to={ROUTES.PUBLIC.INSTALL}
          className="inline-flex h-8 shrink-0 items-center rounded-full bg-amber-500 px-3 text-[12.5px] font-bold text-white hover:bg-amber-600"
        >
          Como instalar
        </Link>
      ) : (
        state === 'off' && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-3 text-[12.5px] font-bold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ativar
          </button>
        )
      )}
      <button
        type="button"
        onClick={hide}
        aria-label="Agora não"
        className="rounded-full p-1 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
