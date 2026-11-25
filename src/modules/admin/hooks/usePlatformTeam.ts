import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { isReauthRequired, sharingErrorText } from '../lib/sharing';
import { mfaService } from '@/modules/auth/services/mfaService';
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
 * Só quem ativou o segundo passo e o tem obrigatório (a sessão nova da palavra-passe fica em aal1)
 * é que depois da palavra-passe também dá o código, para a sessão voltar a aal2.
 * O ecrã tem de mostrar `<ReauthDialog open={reauthOpen} onDone={finishReauth} />` e
 * `<MfaConfirmDialog open={codeOpen} onDone={finishCode} />`.
 */
export const useSuperAdminAction = () => {
  const { toast } = useToast();
  const refreshSharing = useRefreshSharing();
  const [pending, setPending] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const codeResolver = useRef<((ok: boolean) => void) | null>(null);

  const askReauth = () =>
    new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setReauthOpen(true);
    });

  const askCode = () =>
    new Promise<boolean>(resolve => {
      codeResolver.current = resolve;
      setCodeOpen(true);
    });

  // Se o ecrã sai com um diálogo aberto, a promessa pendente não fica à espera para sempre
  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
      codeResolver.current?.(false);
      codeResolver.current = null;
    },
    []
  );

  const finishCode = useCallback((ok: boolean) => {
    codeResolver.current?.(ok);
    codeResolver.current = null;
    setCodeOpen(false);
  }, []);

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
          // A palavra-passe deixa a sessão em aal1: quem tem o segundo passo obrigatório dá o código
          const level = await mfaService.levels();
          if (level?.currentLevel === 'aal1' && level.nextLevel === 'aal2') {
            if (!(await askCode())) return false;
          }
          try {
            await action();
          } catch (second) {
            if (!isReauthRequired(second)) throw second;
            // Mesmo depois da palavra-passe a base acha a sessão antiga: repetir não resolve
            toast({
              title: 'Não foi possível concluir',
              description: 'A sua sessão está demasiado antiga. Saia e entre outra vez.',
              variant: 'destructive',
            });
            return false;
          }
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

  return { run, pending, reauthOpen, finishReauth, codeOpen, finishCode };
};
