import { supabase } from '@/integrations/supabase/client';

/** Listas geridas no admin: departamentos e funções (cargos) das fichas dos colaboradores. */
export type CatalogKind = 'departments' | 'job_positions';

export interface CatalogItem {
  id: string;
  name: string;
}

/** Coluna da ficha do colaborador que guarda o nome escolhido. */
const EMPLOYEE_COLUMN: Record<CatalogKind, 'department' | 'position'> = {
  departments: 'department',
  job_positions: 'position',
};

const friendly = (error: { code?: string; message: string }) =>
  error.code === '23505' ? new Error('Já existe um item com esse nome.') : new Error(error.message);

export const catalogService = {
  /** Itens da lista, por ordem alfabética. */
  list: async (kind: CatalogKind): Promise<{ data: CatalogItem[]; error: unknown }> => {
    const { data, error } = await supabase.from(kind).select('id, name');
    const items = (data ?? []).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    return { data: items, error };
  },

  /** Quantos colaboradores (ativos ou não) têm cada nome na ficha. */
  usage: async (kind: CatalogKind): Promise<{ data: Map<string, number>; error: unknown }> => {
    const column = EMPLOYEE_COLUMN[kind];
    const { data, error } = await supabase.from('employees').select(column).not(column, 'is', null);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Record<string, string | null>[]) {
      const name = row[column];
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return { data: counts, error };
  },

  create: async (kind: CatalogKind, name: string) => {
    const { data, error } = await supabase
      .from(kind)
      .insert({ name: name.trim() })
      .select('id, name')
      .single();
    return { data: data as CatalogItem | null, error: error ? friendly(error) : null };
  },

  /** Muda o nome (as fichas com o nome antigo mudam também, na base de dados). */
  rename: async (kind: CatalogKind, id: string, name: string) => {
    const { error } = await supabase.from(kind).update({ name: name.trim() }).eq('id', id);
    return { error: error ? friendly(error) : null };
  },

  /** Tira da lista (as fichas guardam o nome que tinham até alguém escolher outro). */
  remove: async (kind: CatalogKind, id: string) => {
    const { error } = await supabase.from(kind).delete().eq('id', id);
    return { error: error ? new Error(error.message) : null };
  },
};
