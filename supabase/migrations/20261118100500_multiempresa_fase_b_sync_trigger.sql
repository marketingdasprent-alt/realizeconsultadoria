-- Multiempresa, Fase B (ponto 3): liga rz_sync_membership a employees.
--
-- APLICAR POR ÚLTIMO, só depois de 20261118100000_multiempresa_fase_b.sql E do preenchimento
-- inicial das pertenças. employees é uma tabela viva: este gatilho corre em cada escrita relevante.
-- A função rz_sync_membership não é alterada (existe na migração-base).
--
-- VERIFICAÇÃO PRÉVIA (tem de dar 0 linhas; senão uma escrita legítima em employees pode falhar
-- com violação do índice company_memberships_one_active_employee_uq):
--
--   -- colaboradores ativos com ficha em mais do que uma empresa
--   SELECT user_id, count(DISTINCT company_id)
--     FROM public.employees
--    WHERE is_active AND user_id IS NOT NULL
--    GROUP BY user_id
--   HAVING count(DISTINCT company_id) > 1;
--
-- Risco residual (ver relatório): ligar o gatilho faz com que criar/reativar/mover uma ficha cujo
-- user_id já seja colaborador ATIVO noutra empresa falhe (23505). É a regra "uma só empresa", mas
-- a app deve tratar esse erro ao atribuir/mover colaboradores.
--
-- Reversão: supabase/rollbacks/20261118100000_multiempresa_fase_b_rollback.sql (passo 3).

DROP TRIGGER IF EXISTS employees_sync_membership ON public.employees;
CREATE TRIGGER employees_sync_membership
  AFTER INSERT OR UPDATE OF user_id, company_id, is_active ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.rz_sync_membership();
