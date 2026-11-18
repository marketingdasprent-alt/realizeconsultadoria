-- Multiempresa, Fase B: endurecimento da camada (só esquema; nenhum dado de produção).
--
--   1. O último administrador ativo de uma empresa também não se apaga (DELETE), nem por
--      apagar a conta (company_memberships.user_id -> auth.users ON DELETE CASCADE).
--   2. Um colaborador só pode ter uma pertença de colaborador ativa (admin e gestor não são limitados).
--   3. (NÃO está aqui) A ligação de rz_sync_membership a employees fica em
--      20261118100500_multiempresa_fase_b_sync_trigger.sql, para aplicar por último,
--      depois do preenchimento inicial das pertenças.
--   4. As sequências de share_request_attempts deixam de ser acessíveis a anon/authenticated.
--
-- Idempotente. Reversão: supabase/rollbacks/20261118100000_multiempresa_fase_b_rollback.sql
-- (fora desta pasta; não corre sozinha).

-- ============================================================================================
-- 1. rz_membership_guard: UPDATE exatamente como na migração-base; DELETE novo.
--    Mesma assinatura e mesmo SET search_path; a ACL (só service_role) mantém-se.
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.rz_membership_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Só protege o último admin ativo de uma empresa que continua a existir. Se a empresa já foi
    -- apagada (cascade de companies), deixa apagar: senão não se conseguia apagar uma empresa.
    IF OLD.role = 'admin' AND OLD.status = 'ativo'
       AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN
      -- Serializa por empresa (o mesmo bloqueio do UPDATE).
      PERFORM pg_advisory_xact_lock(hashtextextended(OLD.company_id::text, 0));
      IF NOT EXISTS (
        SELECT 1 FROM public.company_memberships m
        WHERE m.company_id = OLD.company_id AND m.role = 'admin' AND m.status = 'ativo' AND m.id <> OLD.id
      ) THEN
        RAISE EXCEPTION 'last_admin'
          USING ERRCODE = '55000', DETAIL = 'Uma empresa tem de ter pelo menos um administrador ativo.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

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

DROP TRIGGER IF EXISTS company_memberships_guard_delete ON public.company_memberships;
CREATE TRIGGER company_memberships_guard_delete
  BEFORE DELETE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.rz_membership_guard();

-- ============================================================================================
-- 2. Um colaborador só numa empresa ativa
--    VERIFICAÇÃO PRÉVIA (correr antes; tem de dar 0 linhas, senão a criação do índice falha e a
--    migração inteira é anulada):
--
--      SELECT user_id, count(*)
--        FROM public.company_memberships
--       WHERE role = 'colaborador' AND status = 'ativo'
--       GROUP BY user_id
--      HAVING count(*) > 1;
-- ============================================================================================
CREATE UNIQUE INDEX IF NOT EXISTS company_memberships_one_active_employee_uq
  ON public.company_memberships USING btree (user_id)
  WHERE (role = 'colaborador' AND status = 'ativo');

-- ============================================================================================
-- 4. Sequência de share_request_attempts: só o servidor.
--    rz_request_share é SECURITY DEFINER (corre como o dono da sequência), por isso continua a
--    inserir; anon e authenticated nunca inserem diretamente (a tabela não lhes dá INSERT).
-- ============================================================================================
DO $seq$
BEGIN
  IF to_regclass('public.share_request_attempts_id_seq') IS NOT NULL THEN
    REVOKE ALL ON SEQUENCE public.share_request_attempts_id_seq FROM PUBLIC, anon, authenticated;
    GRANT USAGE, SELECT ON SEQUENCE public.share_request_attempts_id_seq TO service_role;
  END IF;
END
$seq$;
