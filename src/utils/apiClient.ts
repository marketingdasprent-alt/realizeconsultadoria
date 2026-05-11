// src/utils/apiClient.ts
// Cliente centralizado para requisições à API

import { supabase } from '@/integrations/supabase/client';

/**
 * Wrapper para chamadas ao Supabase com tratamento de erro centralizado
 */
export const apiClient = {
  /**
   * Executar RPC do Supabase com tratamento de erro
   */
  async rpc<T>(
    functionName: string,
    params: Record<string, any> = {}
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc(functionName, params);

      if (error) {
        console.error(`RPC Error [${functionName}]:`, error);
        return {
          data: null,
          error: new Error(error.message || 'Erro ao executar operação'),
        };
      }

      return { data: data as T, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`RPC Exception [${functionName}]:`, errorMessage);
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }
  },

  /**
   * Query a uma tabela do Supabase
   */
  async query<T>(
    table: string,
    options: {
      select?: string;
      filter?: { column: string; operator: string; value: any }[];
      order?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      let query = supabase.from(table).select(options.select || '*');

      // Aplicar filtros
      if (options.filter) {
        options.filter.forEach(({ column, operator, value }) => {
          query = query[operator as any](column, value);
        });
      }

      // Aplicar ordenação
      if (options.order) {
        query = query.order(options.order.column, {
          ascending: options.order.ascending !== false,
        });
      }

      // Aplicar limite e offset
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Query Error [${table}]:`, error);
        return {
          data: null,
          error: new Error(error.message),
        };
      }

      return { data: data as T[], error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`Query Exception [${table}]:`, errorMessage);
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }
  },

  /**
   * Inserir dados em uma tabela
   */
  async insert<T>(table: string, data: any): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { data: result, error } = await supabase.from(table).insert(data).select().single();

      if (error) {
        console.error(`Insert Error [${table}]:`, error);
        return {
          data: null,
          error: new Error(error.message),
        };
      }

      return { data: result as T, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`Insert Exception [${table}]:`, errorMessage);
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }
  },

  /**
   * Atualizar dados em uma tabela
   */
  async update<T>(
    table: string,
    id: string,
    data: any
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Update Error [${table}]:`, error);
        return {
          data: null,
          error: new Error(error.message),
        };
      }

      return { data: result as T, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`Update Exception [${table}]:`, errorMessage);
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }
  },

  /**
   * Eliminar dados de uma tabela
   */
  async delete(table: string, id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) {
        console.error(`Delete Error [${table}]:`, error);
        return {
          success: false,
          error: new Error(error.message),
        };
      }

      return { success: true, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`Delete Exception [${table}]:`, errorMessage);
      return {
        success: false,
        error: new Error(errorMessage),
      };
    }
  },
};
