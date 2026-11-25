import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { isReauthRequired, sharingErrorText } from '../lib/sharing';
import { superAdminService } from '../services/superAdminService';
import { useRefreshSharing } from './useSharing';

/** Raiz das consultas da equipa da plataforma (invalidar depois de adicionar ou retirar). */
export const SUPER_ADMINS_KEY = ['admin', 'super-admins'] as const;

/** Quem são os super admins (só a base responde a um super admin). */
export const useSuperAdmins = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: [...SUPER_ADMINS_KEY, 'list'],
    queryFn: superAdminService.list,
    staleTime: 30_000,
    retry: false,
  });

/** Quem pode passar a super admin: administradores de empresas que ainda não o são. */
export const useSuperAdminCandidates = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: [...SUPER_ADMINS_KEY, 'candidates'],
    queryFn: superAdminService.candidates,
    staleTime: 0,
    retry: false,
  });

/**
 * Executa uma escrita sobre super admins. O segundo passo (TOTP) não é obrigatório: se a base pedir
 * um login recente (`reauth_required`), abre o diálogo da palavra-passe e repete a chamada uma vez.
 * O ecrã tem de mostrar `<ReauthDialog open={reauthOpen} onDone={finishReauth} />`.
 */
export const useSuperAdminAction = () => {
  const { toast } = useToast();
  const refreshSharing = useRefreshSharing();
  const [pending, setPending] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const askReauth = () =>
    new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setReauthOpen(true);
    });

  // Se o ecrã sai com o diálogo aberto, a promessa pendente não fica à espera para sempre
  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
    },
    []
  );

  const finishReauth = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setReauthOpen(false);
  }, []);

  /** Devolve `true` se correu bem; `false` se falhou ou a pessoa desistiu da palavra-passe. */
  const run = useCallback(
    async (
      action: () => Promise<void>,
      success: string,
      refetch: () => unknown
    ): Promise<boolean> => {
      setPending(true);
      try {
        try {
          await action();
        } catch (error) {
          if (!isReauthRequired(error)) throw error;
          if (!(await askReauth())) return false;
          await action();
        }
        toast({ title: success });
        // A ação já resultou: atualizar as listas é à parte e um erro aqui não a desfaz
        void (async () => {
          try {
            await Promise.all([refetch(), refreshSharing()]);
          } catch {
            // as listas atualizam-se na próxima leitura
          }
        })();
        return true;
      } catch (error) {
        toast({
          title: 'Não foi possível concluir',
          description: sharingErrorText(error),
          variant: 'destructive',
        });
        return false;
      } finally {
        setPending(false);
      }
    },
    [toast, refreshSharing]
  );

  return { run, pending, reauthOpen, finishReauth };
};
