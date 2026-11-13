// Admin → Realize Mail → Postos: postos de email com as caixas que o admin escolhe e o link para
// quem vai instalar a app. Leitura por funções da base de dados (só admin); criar, mudar, enviar
// link e apagar pela função mail-posto.
import { supabase } from '@/integrations/supabase/client';

export type PostoBoxStatus = 'active' | 'reauth' | 'error' | 'pending' | string;

export interface PostoBox {
  accessId: string;
  title: string;
  email: string;
  accountId: string | null;
  /** 'pending' = a caixa ainda não foi ligada ao Webmail. */
  status: PostoBoxStatus;
  lastError: string | null;
}

export interface MailPosto {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
  /** Há um link enviado que ainda não foi usado nem expirou. */
  inviteExpiresAt: string | null;
  boxes: PostoBox[];
}

/** Acesso de email que se pode pôr num posto. */
export interface PostoAccess {
  accessId: string;
  title: string;
  email: string;
  companyName: string | null;
  connected: boolean;
}

export interface PostoProblem {
  accessId: string;
  email: string;
  message: string;
}

const UNAVAILABLE = 'Não foi possível. Tente outra vez.';

const rpc = (name: string) =>
  supabase.rpc(name as never) as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;

const call = async <T>(body: Record<string, unknown>) => {
  try {
    const { data, error } = await supabase.functions.invoke('mail-posto', { body });
    if (error || !data) return { data: null as T | null, error: UNAVAILABLE };
    if (!data.ok) return { data: null as T | null, error: (data.message as string) || UNAVAILABLE };
    return { data: data.data as T, error: null };
  } catch {
    return { data: null as T | null, error: UNAVAILABLE };
  }
};

export const mailPostosService = {
  list: async () => {
    const { data, error } = await rpc('admin_mail_postos');
    return { data: (data ?? []) as MailPosto[], error };
  },

  accesses: async () => {
    const { data, error } = await rpc('admin_mail_posto_accesses');
    return { data: (data ?? []) as PostoAccess[], error };
  },

  create: (name: string, accessIds: string[]) =>
    call<{ id: string; problems: PostoProblem[] }>({
      action: 'create',
      name,
      access_ids: accessIds,
    }),

  update: (postoId: string, name: string, accessIds: string[]) =>
    call<{ id: string; problems: PostoProblem[] }>({
      action: 'update',
      posto_id: postoId,
      name,
      access_ids: accessIds,
    }),

  invite: (postoId: string) =>
    call<{ link: string; expiresAt: string }>({ action: 'invite', posto_id: postoId }),

  remove: (postoId: string) => call<{ id: string }>({ action: 'delete', posto_id: postoId }),
};
