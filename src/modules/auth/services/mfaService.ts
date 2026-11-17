import type { Factor } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AssuranceLevels } from '../lib/mfa';

export interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export interface MfaStatus {
  /** O segundo passo ativo da conta, se houver. */
  active: Factor | null;
}

const FRIENDLY_NAME = 'Realize';

/** Segundo passo da conta (só um, o TOTP verificado). Lança em caso de erro de rede. */
const status = async (): Promise<MfaStatus> => {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return { active: data.totp[0] ?? null };
};

/** Nível de segurança desta sessão (null se não deu para saber). */
const levels = async (): Promise<AssuranceLevels | null> => {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
};

/** Começa a configuração: limpa as que ficaram a meio e devolve o QR e a chave. */
const startEnrollment = async (): Promise<Enrollment> => {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Configurações abandonadas (nunca confirmadas) bloqueariam uma nova.
  const stale = (factors?.all ?? []).filter(factor => factor.status === 'unverified');
  await Promise.all(stale.map(factor => supabase.auth.mfa.unenroll({ factorId: factor.id })));
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: FRIENDLY_NAME,
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
};

/** Confirma um código (configuração nova, desafio no login ou antes de desativar). */
const verify = async (factorId: string, code: string): Promise<void> => {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
};

/** Remove o segundo passo (a sessão tem de estar confirmada: ver `verify`). */
const disable = async (factorId: string): Promise<void> => {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
};

/** Cancela uma configuração a meio. */
const cancelEnrollment = async (factorId: string): Promise<void> => {
  await supabase.auth.mfa.unenroll({ factorId });
};

export const mfaService = { status, levels, startEnrollment, verify, disable, cancelEnrollment };
