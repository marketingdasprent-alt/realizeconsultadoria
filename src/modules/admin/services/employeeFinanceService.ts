import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type EmployeeMonthlyFinance =
  Database['public']['Tables']['employee_monthly_finances']['Row'];

export type EmployeeMonthlyFinanceUpsert =
  Database['public']['Tables']['employee_monthly_finances']['Insert'];

export const DISCOUNT_CATEGORIES = [
  {
    value: 'bolt',
    label: 'Bolt',
    badge: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    dot: 'bg-yellow-500',
  },
  {
    value: 'rend',
    label: 'Renda',
    badge: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    dot: 'bg-blue-500',
  },
  {
    value: 'combustivel',
    label: 'Combustível',
    badge: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    dot: 'bg-orange-500',
  },
  {
    value: 'adiantamento',
    label: 'Adiantamento',
    badge: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    dot: 'bg-purple-500',
  },
  {
    value: 'emprestimo',
    label: 'Empréstimo',
    badge: 'bg-red-100 text-red-800 hover:bg-red-100',
    dot: 'bg-red-500',
  },
  {
    value: 'outro',
    label: 'Outro',
    badge: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
    dot: 'bg-slate-400',
  },
] as const;

export type DiscountCategoryValue = (typeof DISCOUNT_CATEGORIES)[number]['value'];

export const getCategoryColor = (value: string): string =>
  DISCOUNT_CATEGORIES.find(c => c.value === value)?.badge ?? 'bg-slate-100 text-slate-700';

export const getCategoryDot = (value: string): string =>
  DISCOUNT_CATEGORIES.find(c => c.value === value)?.dot ?? 'bg-slate-400';

export interface DiscountItem {
  id: string;
  category: string;
  description: string | null;
  amount: number;
}

export const getCategoryLabel = (value: string): string =>
  DISCOUNT_CATEGORIES.find(c => c.value === value)?.label ?? value;

export const DEFAULT_TAXA_KM = 0.4;

export interface FinanceFields {
  valor_recebido: number;
  valor_subsidio_alimentacao: number;
  valor_cartao_da: number;
  valor_descontado: number;
  km_extras: number;
  taxa_km: number;
  discount_items: DiscountItem[];
}

export const sumDiscountItems = (items: DiscountItem[] | undefined | null): number =>
  (items || []).reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

export const computeAjudaCusto = (km: number, taxa: number): number =>
  (Number(km) || 0) * (Number(taxa) || 0);

export const employeeFinanceService = {
  /**
   * Carrega todos os registos financeiros de um mês/ano específico.
   */
  listByPeriod: async (year: number, month: number) => {
    try {
      const { data, error } = await supabase
        .from('employee_monthly_finances')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [] as EmployeeMonthlyFinance[], error };
    }
  },

  /**
   * Cria ou actualiza um registo mensal (upsert por employee_id+year+month).
   */
  upsert: async (
    employeeId: string,
    year: number,
    month: number,
    fields: Partial<FinanceFields>
  ) => {
    try {
      const payload: EmployeeMonthlyFinanceUpsert = {
        employee_id: employeeId,
        year,
        month,
        valor_recebido: fields.valor_recebido ?? 0,
        valor_subsidio_alimentacao: fields.valor_subsidio_alimentacao ?? 0,
        valor_cartao_da: fields.valor_cartao_da ?? 0,
        valor_descontado: fields.valor_descontado ?? 0,
        km_extras: fields.km_extras ?? 0,
        taxa_km: fields.taxa_km ?? DEFAULT_TAXA_KM,
        discount_items: (fields.discount_items ?? []) as unknown,
      };

      const { data, error } = await supabase
        .from('employee_monthly_finances')
        .upsert(payload, { onConflict: 'employee_id,year,month' })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
