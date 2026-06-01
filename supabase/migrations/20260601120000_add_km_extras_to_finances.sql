-- Adiciona suporte para registo de KM Extras e Ajuda de Custo
-- mensal por colaborador. A Ajuda de Custo é sempre calculada
-- como km_extras * taxa_km (não é armazenada).

ALTER TABLE public.employee_monthly_finances
  ADD COLUMN IF NOT EXISTS km_extras numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_km numeric NOT NULL DEFAULT 0.40;
