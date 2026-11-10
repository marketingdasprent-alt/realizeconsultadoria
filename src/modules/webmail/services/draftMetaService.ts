// O que o servidor de email não guarda num rascunho (Bcc, conversa, citação em HTML, anexos do
// email reencaminhado, assinatura escolhida): tabela mail_draft_meta, uma linha por rascunho.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { ComposeDraft, RemoteAttachments } from '../types';

export interface DraftMeta {
  bcc?: string;
  inReplyTo?: string;
  replyHtml?: string;
  forward?: ComposeDraft['forward'];
  remote?: RemoteAttachments | null;
  signature?: string;
}

/** A citação em HTML só se não for enorme (imagens embebidas): senão volta como texto. */
const MAX_HTML = 400_000;

const table = () => (supabase as unknown as SupabaseClient).from('mail_draft_meta');

export const draftMetaService = {
  save: async (accountId: string, draftId: string, meta: DraftMeta) => {
    const light: DraftMeta = {
      ...meta,
      replyHtml: meta.replyHtml && meta.replyHtml.length <= MAX_HTML ? meta.replyHtml : undefined,
      forward:
        meta.forward && meta.forward.html.length > MAX_HTML
          ? { ...meta.forward, html: '' }
          : meta.forward,
    };
    const { error } = await table().upsert(
      { account_id: accountId, draft_id: draftId, meta: light },
      { onConflict: 'account_id,draft_id' }
    );
    return { error };
  },

  get: async (accountId: string, draftId: string): Promise<DraftMeta | null> => {
    const { data } = await table()
      .select('meta')
      .eq('account_id', accountId)
      .eq('draft_id', draftId)
      .maybeSingle();
    return (data?.meta as DraftMeta | undefined) ?? null;
  },

  remove: async (accountId: string, draftId: string) => {
    await table().delete().eq('account_id', accountId).eq('draft_id', draftId);
  },
};
