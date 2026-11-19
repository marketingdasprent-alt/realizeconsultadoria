-- Multiempresa, D2: gatilho que protege a identidade da ficha de colaborador (employees).
-- Fecha a lacuna confirmada na base real: a RLS deixa qualquer admin escrever qualquer ficha e
-- nenhum gatilho impedia apontar uma ficha a outra conta (user_id) ou trocar o email de uma ficha
-- já ligada a uma conta.
--
-- Regras (só para sessões com auth.uid(); o SQL Editor e o service role passam, por isso as Edge
-- Functions create-employee-with-password, update-employee-email e repair-mixed-account não são afetadas):
--   * user_id: só pode ser definido de NULL para o próprio auth.uid() (a ligação automática do
--     AuthCallbackPage). Qualquer outra alteração, no UPDATE ou no INSERT, é recusada.
--   * email: não pode mudar numa ficha que já tem user_id (o email muda-se pela Edge Function).
--   * company_id fica de fora de propósito: rz_transfer_employee já o muda de forma validada e auditada.
--
-- NÃO aplicar sem autorização. Aplicar no SQL Editor, numa única chamada. Ensaio: supabase/tests/.

CREATE OR REPLACE FUNCTION public.employees_guard_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Não pode criar uma ficha ligada a outra conta'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT (OLD.user_id IS NULL AND NEW.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'A conta ligada a uma ficha não pode ser alterada'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email AND OLD.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'O email de uma ficha com conta só se altera pela função própria'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.employees_guard_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employees_guard_identity_update ON public.employees;
CREATE TRIGGER employees_guard_identity_update
  BEFORE UPDATE OF user_id, email ON public.employees
  FOR EACH ROW
  WHEN (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.employees_guard_identity();

DROP TRIGGER IF EXISTS employees_guard_identity_insert ON public.employees;
CREATE TRIGGER employees_guard_identity_insert
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.employees_guard_identity();
