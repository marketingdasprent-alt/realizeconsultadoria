import { supabase } from '@/integrations/supabase/client';
import { mailErrorText, mailService } from '@/modules/webmail/services/mailService';
import { isEmailCategory } from '../lib/credentials';
import type {
  Credential,
  CredentialCategory,
  CredentialCompany,
  CredentialEmployee,
  MailboxStatus,
} from '../lib/credentials';

interface ServiceResult<T> {
  data: T | null;
  error: unknown;
}

export interface CredentialsData {
  credentials: Credential[];
  categories: CredentialCategory[];
  companies: CredentialCompany[];
  employees: CredentialEmployee[];
  /** Pessoas de cada email departamental (access_id → employee_id[]). */
  shares: Map<string, string[]>;
  mailboxes: Map<string, MailboxStatus>;
}

export interface CredentialInput {
  title: string;
  username: string;
  password: string;
  url: string | null;
  notes: string | null;
  company_id: string;
  category_id: string | null;
  employee_id: string | null;
}

export const credentialService = {
  /** Acessos, categorias, empresas, colaboradores, partilhas e estado das caixas. */
  load: async (): Promise<ServiceResult<CredentialsData>> => {
    try {
      const [credentials, categories, companies, employees, shares, mailboxes] = await Promise.all([
        supabase
          .from('accesses')
          .select('*, companies(name), access_categories(name, icon), employees(name)')
          .order('title'),
        supabase.from('access_categories').select('id, name, icon').order('name'),
        supabase.from('companies').select('id, name, domain').eq('is_active', true).order('name'),
        supabase.from('employees').select('id, name, company_id, is_active, user_id').order('name'),
        supabase.from('employee_department_emails').select('access_id, employee_id'),
        supabase.rpc('mail_access_status'),
      ]);
      const error =
        credentials.error ??
        categories.error ??
        companies.error ??
        employees.error ??
        shares.error ??
        mailboxes.error;
      if (error) throw error;
      const shareMap = new Map<string, string[]>();
      for (const row of shares.data ?? [])
        shareMap.set(row.access_id, [...(shareMap.get(row.access_id) ?? []), row.employee_id]);
      return {
        data: {
          credentials: (credentials.data ?? []) as unknown as Credential[],
          categories: (categories.data ?? []) as CredentialCategory[],
          companies: (companies.data ?? []) as CredentialCompany[],
          employees: (employees.data ?? []) as CredentialEmployee[],
          shares: shareMap,
          mailboxes: new Map(
            (mailboxes.data ?? []).map(row => [row.access_id, row as MailboxStatus])
          ),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Este endereço já é a caixa de outro acesso de email? (Daria duas caixas iguais no
   * Webmail.) O mesmo utilizador noutros acessos — sites, sistemas — é normal e pode repetir.
   */
  isDuplicateEmail: async (address: string, excludeId?: string) => {
    let query = supabase
      .from('accesses')
      .select('id, access_categories(name)')
      .ilike('username', address.trim());
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    return ((data ?? []) as { access_categories: { name: string } | null }[]).some(row =>
      isEmailCategory(row.access_categories?.name)
    );
  },

  /** Cria ou atualiza o acesso; devolve o id. */
  save: async (input: CredentialInput, id?: string): Promise<ServiceResult<string>> => {
    const { data, error } = id
      ? await supabase.from('accesses').update(input).eq('id', id).select('id').single()
      : await supabase.from('accesses').insert(input).select('id').single();
    return { data: data?.id ?? null, error };
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('accesses').delete().eq('id', id);
    return { ok: !error, error };
  },

  /** Quem tem o email departamental (substitui a lista toda). */
  setShares: async (accessId: string, employeeIds: string[]) => {
    const { error: deleteError } = await supabase
      .from('employee_department_emails')
      .delete()
      .eq('access_id', accessId);
    if (deleteError) return { ok: false, error: deleteError };
    if (employeeIds.length === 0) return { ok: true, error: null };
    const { error } = await supabase
      .from('employee_department_emails')
      .insert(employeeIds.map(employee_id => ({ access_id: accessId, employee_id })));
    return { ok: !error, error };
  },

  /** Testa o login e liga a caixa ao Webmail de quem a deve ter. */
  linkMailbox: async (accessId: string) => {
    const { data, error } = await mailService.shareAccess(accessId);
    return {
      members: data?.members ?? null,
      error: error ? mailErrorText(error) || 'Não foi possível ligar a caixa.' : null,
    };
  },
};
