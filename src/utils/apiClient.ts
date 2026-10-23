// src/utils/apiClient.ts
// Cliente centralizado para requisições à API

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Este wrapper recebe nomes de tabelas/funções dinâmicos (string), que não podem ser
 * verificados contra o schema gerado. Usa-se a vista sem schema do mesmo cliente.
 */
const untypedSupabase: SupabaseClient = supabase;

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in';

/**
 * Wrapper para chamadas ao Supabase com tratamento de erro centralizado
 */
export const apiClient = {
  /**
   * Executar RPC do Supabase com tratamento de erro
   */
  async rpc<T>(
    functionName: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { data, error } = await untypedSupabase.rpc(functionName, params);

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
      filter?: { column: string; operator: FilterOperator; value: unknown }[];
      order?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      let query = untypedSupabase.from(table).select(options.select || '*');

      // Aplicar filtros
      if (options.filter) {
        options.filter.forEach(({ column, operator, value }) => {
          switch (operator) {
            case 'in':
              query = query.in(column, value as readonly unknown[]);
              break;
            case 'is':
              query = query.is(column, value as boolean | null);
              break;
            case 'like':
              query = query.like(column, String(value));
              break;
            case 'ilike':
              query = query.ilike(column, String(value));
              break;
            case 'eq':
              query = query.eq(column, value);
              break;
            case 'neq':
              query = query.neq(column, value);
              break;
            case 'gt':
              query = query.gt(column, value);
              break;
            case 'gte':
              query = query.gte(column, value);
              break;
            case 'lt':
              query = query.lt(column, value);
              break;
            case 'lte':
              query = query.lte(column, value);
              break;
          }
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
  async insert<T>(
    table: string,
    data: Record<string, unknown>
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { data: result, error } = await untypedSupabase
        .from(table)
        .insert(data)
        .select()
        .single();

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
    data: Record<string, unknown>
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { data: result, error } = await untypedSupabase
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
      const { error } = await untypedSupabase.from(table).delete().eq('id', id);

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
