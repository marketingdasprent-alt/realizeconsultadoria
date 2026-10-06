-- =============================================================================
-- Ponto: trabalho remoto com aprovação, tipo decidido no servidor e auditoria
-- =============================================================================
-- 1. Registos fora do local (home office / externo) entram como 'pending' e um
--    admin aprova ou rejeita. Coluna work_mode ('office' | 'remote').
-- 2. Entrada/Saída passa a ser decidida na BD, com lock por colaborador
--    (acaba com duplicados em toques simultâneos e com o tipo desatualizado
--    vindo da app). Uma entrada aberta há mais de 12 h já não "fecha" com a
--    picagem seguinte: evita que uma picagem esquecida inverta os dias seguintes.
-- 3. O colaborador pode "Trocar" Entrada↔Saída do último registo nos 3 minutos
--    seguintes (fica no histórico).
-- 4. Admins aprovam/rejeitam em lote e nunca alteram os próprios registos.
-- 5. Alterações a locais e tags passam a ter histórico.
-- 6. Lista de emails que recebem os pedidos de aprovação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Estado 'pending' e modo de trabalho
-- -----------------------------------------------------------------------------
ALTER TABLE public.time_clock_entries DROP CONSTRAINT IF EXISTS time_clock_entries_status_check;
ALTER TABLE public.time_clock_entries
  ADD CONSTRAINT time_clock_entries_status_check
  CHECK (status IN ('valid', 'flagged', 'pending', 'voided'));

ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS work_mode TEXT NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS employee_note TEXT;

ALTER TABLE public.time_clock_entries DROP CONSTRAINT IF EXISTS time_clock_entries_work_mode_check;
ALTER TABLE public.time_clock_entries
  ADD CONSTRAINT time_clock_entries_work_mode_check CHECK (work_mode IN ('office', 'remote'));

CREATE INDEX IF NOT EXISTS idx_time_clock_entries_pending
  ON public.time_clock_entries (punched_at) WHERE status = 'pending';

-- Histórico ganha as ações 'approve' e 'reject'.
ALTER TABLE public.time_clock_entry_history DROP CONSTRAINT IF EXISTS time_clock_entry_history_action_check;
ALTER TABLE public.time_clock_entry_history
  ADD CONSTRAINT time_clock_entry_history_action_check
  CHECK (action IN ('create', 'update', 'void', 'restore', 'review', 'approve', 'reject', 'delete'));

CREATE OR REPLACE FUNCTION public.log_time_clock_entry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old JSONB;
  _new JSONB;
  _action TEXT;
  _fields TEXT[] := '{}';
  _actor UUID;
  _reason TEXT := NULLIF(current_setting('app.time_clock_reason', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _action := 'create';
    _actor := COALESCE(auth.uid(), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    SELECT COALESCE(array_agg(k ORDER BY k), '{}') INTO _fields
    FROM jsonb_object_keys(_new) AS k
    WHERE k NOT IN ('updated_at', 'updated_by')
      AND _new -> k IS DISTINCT FROM _old -> k;

    IF array_length(_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    _action := CASE
      WHEN OLD.status = 'pending' AND NEW.status IN ('valid', 'flagged') THEN 'approve'
      WHEN OLD.status = 'pending' AND NEW.status = 'voided' THEN 'reject'
      WHEN NEW.status = 'voided' AND OLD.status <> 'voided' THEN 'void'
      WHEN OLD.status = 'voided' AND NEW.status <> 'voided' THEN 'restore'
      WHEN OLD.status = 'flagged' AND NEW.status = 'valid' AND _fields = ARRAY['status'] THEN 'review'
      ELSE 'update'
    END;
    _actor := COALESCE(auth.uid(), NEW.updated_by);
  ELSE
    _old := to_jsonb(OLD);
    _action := 'delete';
    _actor := auth.uid();
  END IF;

  INSERT INTO public.time_clock_entry_history (
    entry_id, employee_id, action, changed_fields, old_data, new_data,
    reason, changed_by, changed_by_name
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.employee_id, OLD.employee_id),
    _action, _fields, _old, _new,
    _reason, _actor, public.time_clock_actor_name(_actor)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Registo atómico de picagens (chamado pela edge function clock-punch)
-- -----------------------------------------------------------------------------
-- Turno máximo para emparelhar: uma entrada com mais de 12 h deixa de estar
-- "aberta" e a picagem seguinte volta a ser uma Entrada.
CREATE OR REPLACE FUNCTION public.time_clock_register_punch(_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID := (_payload ->> 'employee_id')::uuid;
  _last public.time_clock_entries%ROWTYPE;
  _has_last BOOLEAN;
  _type TEXT;
  _new public.time_clock_entries%ROWTYPE;
BEGIN
  IF _employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id em falta';
  END IF;

  -- Serializa picagens do mesmo colaborador (toques duplos / pedidos em paralelo).
  PERFORM pg_advisory_xact_lock(hashtextextended('time_clock:' || _employee_id::text, 0));

  SELECT * INTO _last
  FROM public.time_clock_entries
  WHERE employee_id = _employee_id AND status <> 'voided'
  ORDER BY punched_at DESC
  LIMIT 1;
  _has_last := FOUND;

  IF _has_last AND _last.punched_at > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('duplicate', true, 'entry', to_jsonb(_last));
  END IF;

  _type := CASE
    WHEN _has_last AND _last.entry_type = 'in' AND _last.punched_at > now() - interval '12 hours'
      THEN 'out'
    ELSE 'in'
  END;

  INSERT INTO public.time_clock_entries (
    employee_id, company_id, location_id, tag_id, entry_type, punched_at, source,
    status, flags, latitude, longitude, accuracy_m, distance_m, ip_address,
    ip_country, ip_city, ip_is_proxy, device_id, user_agent, work_mode,
    employee_note, created_by, updated_by
  ) VALUES (
    _employee_id,
    (_payload ->> 'company_id')::uuid,
    NULLIF(_payload ->> 'location_id', '')::uuid,
    NULLIF(_payload ->> 'tag_id', '')::uuid,
    _type,
    now(),
    _payload ->> 'source',
    COALESCE(_payload ->> 'status', 'valid'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload -> 'flags')), '{}'),
    (_payload ->> 'latitude')::double precision,
    (_payload ->> 'longitude')::double precision,
    (_payload ->> 'accuracy_m')::double precision,
    (_payload ->> 'distance_m')::double precision,
    _payload ->> 'ip_address',
    _payload ->> 'ip_country',
    _payload ->> 'ip_city',
    (_payload ->> 'ip_is_proxy')::boolean,
    _payload ->> 'device_id',
    _payload ->> 'user_agent',
    COALESCE(_payload ->> 'work_mode', 'office'),
    NULLIF(trim(COALESCE(_payload ->> 'employee_note', '')), ''),
    (_payload ->> 'user_id')::uuid,
    (_payload ->> 'user_id')::uuid
  )
  RETURNING * INTO _new;

  RETURN jsonb_build_object('duplicate', false, 'entry', to_jsonb(_new));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_register_punch(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.time_clock_register_punch(JSONB) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. "Trocar" Entrada↔Saída pelo próprio colaborador (3 minutos, último registo)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.time_clock_swap_own_entry(_entry_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID := public.get_employee_id_from_user(auth.uid());
  _entry public.time_clock_entries%ROWTYPE;
  _latest UUID;
  _new_type TEXT;
BEGIN
  SELECT * INTO _entry FROM public.time_clock_entries WHERE id = _entry_id FOR UPDATE;
  IF NOT FOUND OR _employee_id IS NULL OR _entry.employee_id <> _employee_id THEN
    RAISE EXCEPTION 'Registo não encontrado';
  END IF;
  IF _entry.status = 'voided' OR _entry.source NOT IN ('nfc', 'gps') THEN
    RAISE EXCEPTION 'Este registo não pode ser trocado';
  END IF;
  IF _entry.created_at < now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'Já passaram mais de 3 minutos. Peça a correção aos RH.';
  END IF;

  SELECT id INTO _latest FROM public.time_clock_entries
  WHERE employee_id = _employee_id AND status <> 'voided'
  ORDER BY punched_at DESC LIMIT 1;
  IF _latest <> _entry_id THEN
    RAISE EXCEPTION 'Só é possível trocar o último registo.';
  END IF;

  _new_type := CASE WHEN _entry.entry_type = 'in' THEN 'out' ELSE 'in' END;
  PERFORM set_config('app.time_clock_reason', 'Trocado pelo colaborador logo após o registo', true);
  UPDATE public.time_clock_entries
  SET entry_type = _new_type, updated_by = auth.uid()
  WHERE id = _entry_id;
  RETURN _new_type;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_swap_own_entry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_swap_own_entry(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Admins: nunca alterar os próprios registos + aprovação em lote
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.time_clock_assert_not_self(_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.employees WHERE id = _employee_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Não pode alterar os seus próprios registos de ponto. Peça a outro administrador.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_assert_not_self(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.time_clock_admin_create_entry(
  _employee_id UUID,
  _entry_type TEXT,
  _punched_at TIMESTAMPTZ,
  _reason TEXT,
  _location_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id UUID;
  _id UUID;
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha de ponto' USING ERRCODE = '42501';
  END IF;
  PERFORM public.time_clock_assert_not_self(_employee_id);
  IF length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da alteração';
  END IF;
  IF _entry_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Tipo de registo inválido';
  END IF;
  IF _punched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Não é possível registar horas no futuro';
  END IF;

  SELECT company_id INTO _company_id FROM public.employees WHERE id = _employee_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  INSERT INTO public.time_clock_entries (
    employee_id, company_id, location_id, entry_type, punched_at,
    source, status, notes, created_by, updated_by
  ) VALUES (
    _employee_id, _company_id, _location_id, _entry_type, _punched_at,
    'admin', 'valid', NULLIF(trim(COALESCE(_notes, '')), ''), auth.uid(), auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.time_clock_admin_update_entry(
  _entry_id UUID,
  _entry_type TEXT,
  _punched_at TIMESTAMPTZ,
  _reason TEXT,
  _notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID;
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha de ponto' USING ERRCODE = '42501';
  END IF;
  SELECT employee_id INTO _employee_id FROM public.time_clock_entries WHERE id = _entry_id;
  IF _employee_id IS NULL THEN
    RAISE EXCEPTION 'Registo não encontrado';
  END IF;
  PERFORM public.time_clock_assert_not_self(_employee_id);
  IF length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da alteração';
  END IF;
  IF _entry_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Tipo de registo inválido';
  END IF;
  IF _punched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Não é possível registar horas no futuro';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  UPDATE public.time_clock_entries
  SET entry_type = _entry_type,
      punched_at = _punched_at,
      notes = NULLIF(trim(COALESCE(_notes, '')), ''),
      updated_by = auth.uid()
  WHERE id = _entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.time_clock_admin_set_status(
  _entry_id UUID,
  _status TEXT,
  _reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID;
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha de ponto' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('voided', 'valid') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  SELECT employee_id INTO _employee_id FROM public.time_clock_entries WHERE id = _entry_id;
  IF _employee_id IS NULL THEN
    RAISE EXCEPTION 'Registo não encontrado';
  END IF;
  PERFORM public.time_clock_assert_not_self(_employee_id);
  IF length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da alteração';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  UPDATE public.time_clock_entries
  SET status = _status,
      updated_by = auth.uid()
  WHERE id = _entry_id;
END;
$$;

-- Aprovar (pendentes/sinalizados → válido) ou rejeitar (→ anulado) vários de uma vez.
CREATE OR REPLACE FUNCTION public.time_clock_admin_review(
  _entry_ids UUID[],
  _decision TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para rever registos de ponto' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;
  IF _decision = 'reject' AND length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da rejeição';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.time_clock_entries e
    JOIN public.employees emp ON emp.id = e.employee_id
    WHERE e.id = ANY(_entry_ids) AND emp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Não pode aprovar ou rejeitar os seus próprios registos. Peça a outro administrador.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config(
    'app.time_clock_reason',
    COALESCE(NULLIF(trim(COALESCE(_reason, '')), ''), 'Aprovado'),
    true
  );

  UPDATE public.time_clock_entries
  SET status = CASE WHEN _decision = 'approve' THEN 'valid' ELSE 'voided' END,
      updated_by = auth.uid()
  WHERE id = ANY(_entry_ids) AND status IN ('pending', 'flagged');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_admin_review(UUID[], TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_admin_review(UUID[], TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Histórico de alterações a locais e tags (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_clock_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_config_history_time
  ON public.time_clock_config_history (changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_time_clock_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  _new JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  _fields TEXT[] := '{}';
  _actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Picagens atualizam last_used_at/last_counter das tags: não é configuração.
    SELECT COALESCE(array_agg(k ORDER BY k), '{}') INTO _fields
    FROM jsonb_object_keys(_new) AS k
    WHERE k NOT IN ('updated_at', 'last_used_at', 'last_counter')
      AND _new -> k IS DISTINCT FROM _old -> k;
    IF array_length(_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Nunca guardar o hash do token das tags no histórico.
  _old := _old - 'token_hash';
  _new := _new - 'token_hash';

  INSERT INTO public.time_clock_config_history (
    table_name, record_id, action, changed_fields, old_data, new_data, changed_by, changed_by_name
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END,
    _fields,
    _old,
    _new,
    _actor,
    public.time_clock_actor_name(_actor)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_time_clock_config_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_time_clock_locations_history ON public.time_clock_locations;
CREATE TRIGGER trg_time_clock_locations_history
  AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_locations
  FOR EACH ROW EXECUTE FUNCTION public.log_time_clock_config_change();

DROP TRIGGER IF EXISTS trg_time_clock_tags_history ON public.time_clock_tags;
CREATE TRIGGER trg_time_clock_tags_history
  AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_tags
  FOR EACH ROW EXECUTE FUNCTION public.log_time_clock_config_change();

DROP TRIGGER IF EXISTS trg_time_clock_config_history_immutable ON public.time_clock_config_history;
CREATE TRIGGER trg_time_clock_config_history_immutable
  BEFORE UPDATE OR DELETE ON public.time_clock_config_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_time_clock_history_mutation();

ALTER TABLE public.time_clock_config_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Timeclock admins view config history" ON public.time_clock_config_history;
CREATE POLICY "Timeclock admins view config history"
  ON public.time_clock_config_history FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

-- -----------------------------------------------------------------------------
-- 6. Destinatários dos emails de aprovação
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_emails_timeclock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.notification_emails_timeclock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Timeclock admins view notification emails" ON public.notification_emails_timeclock;
CREATE POLICY "Timeclock admins view notification emails"
  ON public.notification_emails_timeclock FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

DROP POLICY IF EXISTS "Timeclock editors manage notification emails" ON public.notification_emails_timeclock;
CREATE POLICY "Timeclock editors manage notification emails"
  ON public.notification_emails_timeclock FOR ALL TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'edit')))
  WITH CHECK ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'edit')));
