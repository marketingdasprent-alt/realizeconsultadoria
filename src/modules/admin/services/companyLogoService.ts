// Logo da empresa: ficheiro no bucket público "company-logos" (<empresa>/<hora>.<ext>) e o caminho em
// companies.logo_path. O nome leva a hora, por isso uma logo nova nunca fica presa na cache do
// navegador. A base só deixa escrever o super admin ou o administrador da empresa.
import { supabase } from '@/integrations/supabase/client';
import type { PreparedLogo } from '@/lib/logoImage';

const BUCKET = 'company-logos';

type ServiceResult<T> = { data: T; error: null } | { data: null; error: unknown };

const fail = (error: unknown): { data: null; error: unknown } => ({ data: null, error });

export const companyLogoService = {
  /** O endereço público da logo, ou null se a empresa não tem. */
  publicUrl: (path: string | null | undefined): string | null =>
    path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null,

  /** Envia a logo, grava o caminho na empresa e apaga a anterior (sem falhar se não conseguir). */
  upload: async (
    companyId: string,
    logo: PreparedLogo,
    previousPath: string | null
  ): Promise<ServiceResult<string>> => {
    const path = `${companyId}/${Date.now()}.${logo.ext}`;
    const sent = await supabase.storage
      .from(BUCKET)
      .upload(path, logo.blob, { contentType: logo.blob.type, cacheControl: '31536000' });
    if (sent.error) return fail(sent.error);
    const saved = await supabase.from('companies').update({ logo_path: path }).eq('id', companyId);
    if (saved.error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return fail(saved.error);
    }
    if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath]);
    return { data: path, error: null };
  },

  /** Tira a logo da empresa e apaga o ficheiro. */
  remove: async (companyId: string, path: string): Promise<ServiceResult<null>> => {
    const saved = await supabase.from('companies').update({ logo_path: null }).eq('id', companyId);
    if (saved.error) return fail(saved.error);
    await supabase.storage.from(BUCKET).remove([path]);
    return { data: null, error: null };
  },
};
