import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Audience, BroadcastDraft, BroadcastEmployee } from '../lib/broadcast';
import type { NoticeRead, SentNotice } from '../lib/broadcastReads';
import type { NoticeReactionRow } from '@/modules/social/lib/noticeReactions';

type SentReaction = Omit<NoticeReactionRow, 'notification_id'>;

export type BroadcastHistoryRow = Database['public']['Tables']['marketing_emails']['Row'];

export interface BroadcastSignature {
  id: string;
  name: string;
  html: string;
  is_default: boolean;
}

export interface BroadcastAttachment {
  name: string;
  path: string;
  type: string;
  size: number;
}

export interface BroadcastResult {
  ok: boolean;
  sent: number;
  failed: string[];
  requested: number;
  notices: number;
  error?: string;
}

interface EmployeeRow {
  id: string;
  name: string;
  email: string | null;
  company_id: string;
  department: string | null;
  is_active: boolean;
  user_id: string | null;
  companies: { name: string } | null;
}

export const broadcastService = {
  /** Colaboradores ativos (com empresa e departamento) para escolher a quem enviar. */
  employees: async (): Promise<BroadcastEmployee[]> => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, email, company_id, department, is_active, user_id, companies(name)')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return ((data ?? []) as unknown as EmployeeRow[]).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email ?? '',
      company_id: row.company_id,
      companyName: row.companies?.name ?? null,
      department: row.department,
      is_active: row.is_active,
      user_id: row.user_id,
    }));
  },

  /** Empresas ativas (para escolher a quem enviar). */
  companies: async (): Promise<{ id: string; name: string }[]> => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  /** Últimos comunicados enviados. */
  history: async (): Promise<BroadcastHistoryRow[]> => {
    const { data, error } = await supabase
      .from('marketing_emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Os avisos que um envio criou na app e as confirmações de leitura. Encontram-se pelo autor,
   * assunto e hora (a função cria-os segundos antes de escrever o histórico).
   */
  reads: async (
    row: BroadcastHistoryRow
  ): Promise<{ notices: SentNotice[]; reads: NoticeRead[]; reactions: SentReaction[] }> => {
    const sentAt = new Date(row.created_at).getTime();
    const { data: notices, error } = await supabase
      .from('notifications')
      .select('id, company_id, employee_id')
      .eq('created_by', row.created_by)
      .eq('title', row.subject)
      .gte('created_at', new Date(sentAt - 5 * 60_000).toISOString())
      .lte('created_at', new Date(sentAt + 30_000).toISOString());
    if (error) throw error;
    const ids = (notices ?? []).map(n => n.id);
    if (!ids.length) return { notices: [], reads: [], reactions: [] };
    const [readsRes, reactionsRes] = await Promise.all([
      supabase
        .from('notification_reads')
        .select('notification_id, employee_id, read_at')
        .in('notification_id', ids),
      supabase.from('notice_reactions').select('user_id, emoji').in('notification_id', ids),
    ]);
    if (readsRes.error) throw readsRes.error;
    if (reactionsRes.error) throw reactionsRes.error;
    return {
      notices: notices ?? [],
      reads: readsRes.data ?? [],
      reactions: reactionsRes.data ?? [],
    };
  },

  /** Volta a mandar a notificação a quem ainda não confirmou. */
  remind: async (noticeIds: string[], employeeIds: string[]): Promise<number | null> => {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; sent: number }>(
      'broadcast-send',
      { body: { action: 'remind', noticeIds, employeeIds } }
    );
    return error || !data?.ok ? null : data.sent;
  },

  /**
   * As minhas assinaturas do Webmail, também as da conta de colaborador ligada à de admin.
   * Primeiro a da caixa com o endereço com que entrei, depois as predefinidas.
   */
  mySignatures: async (): Promise<BroadcastSignature[]> => {
    const { data } = await supabase.rpc('broadcast_signatures');
    return data ?? [];
  },

  /** Nome de quem envia ("Thiago Galdino de Sousa" → "Thiago Sousa"), para o remetente. */
  senderName: async (): Promise<string> => {
    const { data } = await supabase.rpc('broadcast_sender');
    const sender = (data ?? {}) as { name?: string | null; department?: string | null };
    const words = (sender.name ?? '').trim().split(/\s+/).filter(Boolean);
    const name = words.length > 2 ? `${words[0]} ${words[words.length - 1]}` : words.join(' ');
    // Nome e departamento (curto), ex.: "Thiago Sousa · Desenvolvimento".
    return [name, sender.department?.trim()].filter(Boolean).join(' · ');
  },

  /** Guarda um anexo (bucket privado marketing-emails) antes de enviar. */
  uploadAttachment: async (file: File): Promise<BroadcastAttachment | null> => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return null;
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('marketing-emails').upload(path, file);
    if (error) return null;
    return { name: file.name, path, type: file.type, size: file.size };
  },

  /** Envia (ou, com test, manda só ao próprio admin). A função relê quem recebe da BD. */
  send: async (input: {
    draft: BroadcastDraft;
    employeeIds: string[];
    audience: Audience & { label: string };
    publishInApp: boolean;
    /** false: só na app (sem email). */
    sendEmail: boolean;
    attachments: BroadcastAttachment[];
    test?: boolean;
  }): Promise<BroadcastResult> => {
    const { data, error } = await supabase.functions.invoke<BroadcastResult>('broadcast-send', {
      body: {
        ...input.draft,
        employeeIds: input.employeeIds,
        audience: input.audience,
        publishInApp: input.publishInApp,
        sendEmail: input.sendEmail,
        attachments: input.attachments,
        test: input.test ?? false,
      },
    });
    if (error || !data) {
      return {
        ok: false,
        sent: 0,
        failed: [],
        requested: 0,
        notices: 0,
        error: 'Não foi possível enviar.',
      };
    }
    return data;
  },
};
