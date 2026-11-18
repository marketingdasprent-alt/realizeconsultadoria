-- Reversão da Fase B multiempresa. NÃO é uma migração: não corre sozinha; executar à mão, por
-- ordem inversa da aplicação, e só os passos necessários. Cada passo é idempotente.

-- ---------------------------------------------------------------------------------------------
-- 4 (inverso). Repor os privilégios das sequências como na base real: anon e authenticated com rwU
--    (r = SELECT, w = UPDATE, U = USAGE).
-- ---------------------------------------------------------------------------------------------
DO $seq$
BEGIN
  IF to_regclass('public.share_request_attempts_id_seq') IS NOT NULL THEN
    GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.share_request_attempts_id_seq TO anon, authenticated;
  END IF;
END
$seq$;

-- ---------------------------------------------------------------------------------------------
-- 3 (inverso). Desligar rz_sync_membership de employees (ficheiro 20261118100500).
--    Não apaga pertenças já criadas ou atualizadas pelo gatilho.
-- ---------------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS employees_sync_membership ON public.employees;

-- ---------------------------------------------------------------------------------------------
-- 2 (inverso). Remover a restrição "um colaborador só numa empresa ativa".
-- ---------------------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.company_memberships_one_active_employee_uq;

-- ---------------------------------------------------------------------------------------------
-- 1 (inverso). Remover o gatilho de DELETE e repor rz_membership_guard exatamente como na
--    migração-base (só UPDATE). O gatilho tem de sair ANTES de repor a função: a versão antiga não
--    trata DELETE e, num DELETE, usaria NEW (nulo).
-- ---------------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS company_memberships_guard_delete ON public.company_memberships;

CREATE OR REPLACE FUNCTION public.rz_membership_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'membership_immutable'
      USING ERRCODE = '23514', DETAIL = 'A empresa e a conta de uma pertença não se alteram.';
  END IF;

  IF NEW.status = 'removido' AND OLD.status <> 'removido' THEN
    NEW.removed_at := coalesce(NEW.removed_at, now());
  ELSIF NEW.status <> 'removido' THEN
    NEW.removed_at := NULL;
  END IF;

  IF OLD.role = 'admin' AND OLD.status = 'ativo' AND (NEW.role <> 'admin' OR NEW.status <> 'ativo') THEN
    -- Serializa por empresa: duas pessoas a baixar dois admins ao mesmo tempo não esvaziam a empresa.
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.company_id::text, 0));
    IF NOT EXISTS (
      SELECT 1 FROM public.company_memberships m
      WHERE m.company_id = OLD.company_id AND m.role = 'admin' AND m.status = 'ativo' AND m.id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'last_admin'
        USING ERRCODE = '55000', DETAIL = 'Uma empresa tem de ter pelo menos um administrador ativo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
