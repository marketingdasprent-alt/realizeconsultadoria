// Contactos do Webmail: quem a pessoa já escreveu (sugestões) e as suas listas de contactos.
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cleanContactName, type ContactEntry, type ContactList } from '../lib/recipients';

const MAX_CONTACTS = 400;

const toMembers = (value: Json): ContactEntry[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = item as { email?: unknown; name?: unknown } | null;
        return typeof row?.email === 'string'
          ? [{ email: row.email, name: typeof row.name === 'string' ? row.name : null }]
          : [];
      })
    : [];

export const contactService = {
  /** Quem já recebeu emails desta pessoa: os mais usados primeiro. */
  listContacts: async () => {
    const { data, error } = await supabase
      .from('mail_contacts')
      .select('email, name')
      .order('uses', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(MAX_CONTACTS);
    return {
      data: (data ?? []).map(row => ({ email: row.email, name: cleanContactName(row.name) })),
      error,
    };
  },

  listLists: async () => {
    const { data, error } = await supabase
      .from('mail_contact_lists')
      .select('id, name, members')
      .order('name');
    return {
      data: (data ?? []).map(row => ({
        id: row.id,
        name: row.name,
        members: toMembers(row.members),
      })) as ContactList[],
      error,
    };
  },

  /** Cria (sem id) ou atualiza uma lista; devolve o id. */
  saveList: async (list: { id?: string; name: string; members: ContactEntry[] }) => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return { id: null, error: new Error('Sessão terminada.') };
    const row = {
      user_id: userId,
      name: list.name.trim(),
      members: list.members.map(({ email, name }) => ({ email, name })) as unknown as Json,
    };
    if (list.id) {
      const { error } = await supabase.from('mail_contact_lists').update(row).eq('id', list.id);
      return { id: list.id, error };
    }
    const { data, error } = await supabase
      .from('mail_contact_lists')
      .insert(row)
      .select('id')
      .single();
    return { id: data?.id ?? null, error };
  },

  deleteList: async (id: string) => {
    const { error } = await supabase.from('mail_contact_lists').delete().eq('id', id);
    return { error };
  },

  /** Regista quem recebeu um email (ou os do histórico de enviados). */
  remember: async (items: { email: string; name?: string | null; uses?: number }[]) => {
    if (!items.length) return { error: null };
    const { error } = await supabase.rpc('mail_remember_contacts', {
      _items: items.map(item => ({
        email: item.email,
        name: item.name ?? null,
        uses: item.uses ?? 1,
      })) as unknown as Json,
    });
    return { error };
  },
};
