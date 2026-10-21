import { supabase } from '@/integrations/supabase/client';
import { AREA_HOME, isOtherSite, switchUrl, type SwitchTarget } from '@/lib/account-switch';

interface SwitchResponse {
  ok: boolean;
  token_hash?: string;
  code?: string;
}

export const accountSwitchService = {
  /** Áreas para onde a pessoa autenticada pode ir sem voltar a entrar. */
  targets: async (): Promise<{ data: SwitchTarget[]; error: unknown }> => {
    const { data, error } = await supabase.rpc('account_switch_targets');
    const targets = (data ?? []).filter(
      (target): target is SwitchTarget => target === 'admin' || target === 'workspace'
    );
    return { data: targets, error };
  },

  /**
   * Abre a área (na própria conta ou na conta ligada) já com a sessão. Só resolve se não
   * conseguiu: em caso de sucesso a página muda de endereço.
   */
  open: async (to: SwitchTarget): Promise<{ error: string }> => {
    const { data, error } = await supabase.functions.invoke<SwitchResponse>('switch-account', {
      body: { to },
    });
    if (error || !data?.ok || !data.token_hash) {
      return {
        error:
          data?.code === 'not_linked'
            ? 'Esta conta não tem acesso a essa área.'
            : 'Não foi possível mudar de área. Tente de novo.',
      };
    }
    const site = { hostname: window.location.hostname, origin: window.location.origin };
    window.location.assign(switchUrl(to, data.token_hash, site));
    return { error: '' };
  },

  /** Troca o código de uso único (vindo do outro site) pela sessão. */
  redeem: async (tokenHash: string): Promise<{ error: unknown }> => {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    return { error };
  },

  /** A área está noutro endereço: é preciso levar a sessão (open), não basta navegar. */
  needsSwitch: (to: SwitchTarget): boolean =>
    isOtherSite(to, { hostname: window.location.hostname, origin: window.location.origin }),

  home: (to: SwitchTarget): string => AREA_HOME[to],
};
