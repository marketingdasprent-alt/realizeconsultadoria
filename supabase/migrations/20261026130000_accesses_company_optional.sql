-- Acessos: a empresa passa a opcional ("Outro" no painel), para emails e logins que não são de
-- nenhuma empresa do grupo (ex.: uma conta gmail ou sapo).
ALTER TABLE public.accesses ALTER COLUMN company_id DROP NOT NULL;
