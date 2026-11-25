// Logo da empresa: ficheiro no bucket público "company-logos" (<empresa>/<hora>.<ext>) e o caminho em
// companies.logo_path. O nome leva a hora, por isso uma logo nova nunca fica presa na cache do
// navegador. A base só deixa escrever o super admin ou o administrador da empresa.
import { supabase } from '@/integrations/supabase/client';
import type { PreparedLogo } from '@/lib/logoImage';

const BUCKET = 'company-logos';

type ServiceResult<T> = { data: T; error: null } | { data: null; error: unknown };

const fail = (error: unknown): { data: null; error: unknown } => ({ data: null, error });

const BUSY = {
  message: 'Já há uma alteração da logo desta empresa em curso. Aguarde um instante.',
};

/** Uma alteração de logo de cada vez por empresa (descartar ou trocar de ecrã a meio não as cruza). */
const inFlight = new Set<string>();
const exclusive = async <T>(
  companyId: string,
  run: () => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> => {
  if (inFlight.has(companyId)) return fail(BUSY);
  inFlight.add(companyId);
  try {
    return await run();
  } finally {
    inFlight.delete(companyId);
  }
};

const NOT_UPDATED = { message: 'A empresa não foi atualizada (sem permissão ou já não existe).' };

/** Grava o caminho na empresa e confirma a linha alterada (a base pode recusar sem dar erro). */
const saveLogoPath = async (companyId: string, path: string | null): Promise<unknown> => {
  const saved = await supabase
    .from('companies')
    .update({ logo_path: path })
    .eq('id', companyId)
    .select('id')
    .maybeSingle();
  if (saved.error) return saved.error;
  return saved.data ? null : NOT_UPDATED;
};

/** Apagar o ficheiro antigo é limpeza: se falhar, a empresa já está certa e não se diz nada. */
const removeQuietly = async (path: string): Promise<void> => {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // sem registo: o caminho do ficheiro não é para ir parar a consolas ou relatórios
  }
};

export const companyLogoService = {
  /** O endereço público da logo, ou null se a empresa não tem. */
  publicUrl: (path: string | null | undefined): string | null =>
    path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null,

  /** Envia a logo, grava o caminho na empresa e apaga a anterior (sem falhar se não conseguir). */
  upload: (
    companyId: string,
    logo: PreparedLogo,
    previousPath: string | null
  ): Promise<ServiceResult<string>> =>
    exclusive(companyId, async () => {
      const path = `${companyId}/${Date.now()}.${logo.ext}`;
      const sent = await supabase.storage
        .from(BUCKET)
        .upload(path, logo.blob, { contentType: logo.blob.type, cacheControl: '31536000' });
      if (sent.error) return fail(sent.error);
      const saveError = await saveLogoPath(companyId, path);
      if (saveError) {
        await removeQuietly(path);
        return fail(saveError);
      }
      if (previousPath) await removeQuietly(previousPath);
      return { data: path, error: null };
    }),

  /** Tira a logo da empresa e apaga o ficheiro. */
  remove: (companyId: string, path: string): Promise<ServiceResult<null>> =>
    exclusive(companyId, async () => {
      const saveError = await saveLogoPath(companyId, null);
      if (saveError) return fail(saveError);
      await removeQuietly(path);
      return { data: null, error: null };
    }),
};
