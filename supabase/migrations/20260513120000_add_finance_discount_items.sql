-- Adiciona coluna JSONB para armazenar a subdivisão do valor descontado
-- Cada item: { id: string, category: string, description: string | null, amount: number }
-- O valor_descontado continua a ser o cache do total (soma dos itens) para queries rápidas.

ALTER TABLE public.employee_monthly_finances
  ADD COLUMN IF NOT EXISTS discount_items JSONB NOT NULL DEFAULT '[]'::jsonb;
