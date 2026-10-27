-- Tarefas criadas no admin (ex.: "Criar tarefa" num serviço pago) por quem não tem ficha de
-- colaborador: as regras normais exigem ficha (empresa = a do autor). Estas funções são só
-- para admins e trabalham na empresa escolhida: lista quem pode receber a tarefa e cria-a
-- com responsável e participantes dessa empresa.

/** Nome nas notificações ("Thiago atribuiu-lhe…"): ficha de colaborador, senão o perfil. */
CREATE OR REPLACE FUNCTION public.rz_first_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    split_part((SELECT e.name FROM employees e WHERE e.user_id = _user_id LIMIT 1), ' ', 1),
    nullif(split_part((SELECT p.name FROM profiles p WHERE p.user_id = _user_id LIMIT 1), ' ', 1), ''),
    'Alguém'
  );
$$;

/** Colaboradores ativos (com conta) de uma empresa — só admins. */
CREATE OR REPLACE FUNCTION public.admin_task_people(_company_id uuid)
RETURNS TABLE (user_id uuid, name text, department text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.rz_is_admin() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  RETURN QUERY
    SELECT e.user_id, btrim(e.name), e.department
    FROM employees e
    WHERE e.company_id = _company_id AND e.is_active AND e.user_id IS NOT NULL
    ORDER BY e.name;
END;
$$;

/** Cria a tarefa na empresa indicada; responsável e participantes têm de ser dessa empresa. */
CREATE OR REPLACE FUNCTION public.admin_create_task(
  _company_id uuid,
  _title text,
  _description text,
  _assignee_id uuid,
  _participant_ids uuid[],
  _due_at timestamptz,
  _priority text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _people uuid[];
BEGIN
  IF NOT public.rz_is_admin() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  IF _assignee_id IS NULL THEN
    RAISE EXCEPTION 'Escolha o responsável.';
  END IF;

  _people := array_remove(array(SELECT DISTINCT unnest(coalesce(_participant_ids, '{}'))), _assignee_id);
  IF EXISTS (
    SELECT 1 FROM unnest(array_append(_people, _assignee_id)) AS p(uid)
    WHERE NOT EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = p.uid AND e.is_active AND e.company_id = _company_id
    )
  ) THEN
    RAISE EXCEPTION 'Só pode escolher colaboradores ativos desta empresa.';
  END IF;

  INSERT INTO tasks (company_id, created_by, title, description, assignee_id, due_at, priority)
  VALUES (_company_id, auth.uid(), btrim(_title), nullif(btrim(coalesce(_description, '')), ''),
          _assignee_id, _due_at, coalesce(_priority, 'medium'))
  RETURNING id INTO _id;

  INSERT INTO task_participants (task_id, user_id)
  SELECT _id, uid FROM unnest(_people) AS uid;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_task_people(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_create_task(uuid, text, text, uuid, uuid[], timestamptz, text)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_task_people(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_task(uuid, text, text, uuid, uuid[], timestamptz, text)
  TO authenticated;
