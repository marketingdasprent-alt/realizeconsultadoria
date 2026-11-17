import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isReauthRequired, sharingErrorText } from '../lib/sharing';
import { useRefreshSharing } from './useSharing';

/**
 * Executa uma escrita de partilha: mostra o resultado, relê as listas e, se o servidor pedir
 * a palavra-passe outra vez (`reauth_required`), abre o diálogo e repete a chamada uma vez.
 * O ecrã tem de mostrar `<ReauthDialog open={reauthOpen} onDone={finishReauth} />`.
 */
export const useSharingAction = () => {
  const { toast } = useToast();
  const refresh = useRefreshSharing();
  const [pending, setPending] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const askReauth = () =>
    new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setReauthOpen(true);
    });

  const finishReauth = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setReauthOpen(false);
  }, []);

  /** Devolve o resultado, ou `undefined` se falhou ou a pessoa desistiu da palavra-passe. */
  const run = async <T>(action: () => Promise<T>, success: string): Promise<T | undefined> => {
    setPending(true);
    try {
      let result: T;
      try {
        result = await action();
      } catch (error) {
        if (!isReauthRequired(error)) throw error;
        if (!(await askReauth())) return undefined;
        result = await action();
      }
      toast({ title: success });
      await refresh();
      return result;
    } catch (error) {
      toast({
        title: 'Não foi possível concluir',
        description: sharingErrorText(error),
        variant: 'destructive',
      });
      return undefined;
    } finally {
      setPending(false);
    }
  };

  return { run, pending, reauthOpen, finishReauth };
};
