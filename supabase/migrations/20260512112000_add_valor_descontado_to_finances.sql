-- Adiciona coluna "valor_descontado" à tabela de finanças mensais
-- (valor descontado por funcionário; NÃO entra no pie chart)
-- Idempotente: se a coluna já existir, é ignorada.

ALTER TABLE public.employee_monthly_finances
  ADD COLUMN IF NOT EXISTS valor_descontado NUMERIC(12,2) NOT NULL DEFAULT 0;
