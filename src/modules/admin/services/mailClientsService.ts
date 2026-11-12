// Admin → Realize Mail: os clientes da app de email (email.realizeconsultadoria.pt). Tudo por
// funções da base de dados que confirmam que quem chama é admin.
import { supabase } from '@/integrations/supabase/client';
import type { MailSignature } from '@/modules/webmail/types';

export interface MailClientAccount {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  status: string;
}

export interface MailClient {
  userId: string;
  mailbox: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
  companyId: string | null;
  companyName: string | null;
  /** A empresa veio do último ticket (não foi associada no admin). */
  companyFromTicket: boolean;
  accounts: MailClientAccount[];
  ticketsOpen: number;
  ticketsTotal: number;
}

const rpc = (name: string, args?: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never) as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;

export const mailClientsService = {
  list: async () => {
    const { data, error } = await rpc('admin_mail_clients');
    return { data: (data ?? []) as MailClient[], error };
  },

  setCompany: (userId: string, companyId: string | null) =>
    rpc('admin_mail_client_set_company', { _user_id: userId, _company_id: companyId }),

  setDisabled: (userId: string, disabled: boolean) =>
    rpc('admin_mail_client_set_disabled', { _user_id: userId, _disabled: disabled }),

  signatures: async (accountId: string) => {
    const { data, error } = await rpc('admin_mail_client_signatures', { _account_id: accountId });
    return { data: (data ?? []) as MailSignature[], error };
  },

  saveSignatures: (accountId: string, list: MailSignature[]) =>
    rpc('admin_mail_client_save_signatures', { _account_id: accountId, _list: list }),

  companies: async () => {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    return (data ?? []).map(c => ({ id: c.id as string, name: String(c.name).trim() }));
  },
};
