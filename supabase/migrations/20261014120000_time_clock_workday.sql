-- =============================================================================
-- Ponto: jornada com Iniciar dia / Pausa / Retomar / Terminar dia (como o Bitrix24)
-- =============================================================================
-- Cada ação continua a ser um registo em time_clock_entries, agora com `kind`:
--   Iniciar dia  = entry_type 'in'  + kind 'work'
--   Pausa        = entry_type 'out' + kind 'break'
--   Retomar      = entry_type 'in'  + kind 'break'
--   Terminar dia = entry_type 'out' + kind 'work'
-- As horas continuam a ser os pares entrada → saída: as pausas ficam fora do tempo
-- trabalhado e os registos antigos (todos 'work') continuam a contar igual.
-- A base valida a sequência (não se pausa um dia por iniciar, nem se inicia dois).
-- Não altera dados existentes. Pode correr mais do que uma vez.

-- -----------------------------------------------------------------------------
-- 1. Tipo de registo: trabalho ou pausa
-- -----------------------------------------------------------------------------
ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'work';

ALTER TABLE public.time_clock_entries
  DROP CONSTRAINT IF EXISTS time_clock_entries_kind_check;
ALTER TABLE public.time_clock_entries
  ADD CONSTRAINT time_clock_entries_kind_check CHECK (kind IN ('work', 'break'));

COMMENT ON COLUMN public.time_clock_entries.kind IS
  'work = início/fim do dia; break = pausa (saída) / retoma (entrada).';

-- -----------------------------------------------------------------------------
-- 2. Estado da jornada: closed (fora) | working (a trabalhar) | paused (em pausa)
-- -----------------------------------------------------------------------------
-- Um dia aberto ou em pausa há mais de 12 h conta como terminado (esquecimento).
CREATE OR REPLACE FUNCTION public.time_clock_workday_state(_employee_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN e.id IS NULL OR e.punched_at <= now() - interval '12 hours' THEN 'closed'
    WHEN e.entry_type = 'in' THEN 'working'
    WHEN e.kind = 'break' THEN 'paused'
    ELSE 'closed'
  END
  FROM (SELECT 1) AS one
  LEFT JOIN LATERAL (
    SELECT id, entry_type, kind, punched_at
    FROM public.time_clock_entries
    WHERE employee_id = _employee_id AND status <> 'voided'
    ORDER BY punched_at DESC
    LIMIT 1
  ) AS e ON true;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_workday_state(UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Registo atómico com a ação escolhida (start | pause | resume | stop)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.time_clock_register_punch(_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID := (_payload ->> 'employee_id')::uuid;
  _action TEXT := _payload ->> 'action';
  _type TEXT := _payload ->> 'entry_type';
  _kind TEXT := 'work';
  _last public.time_clock_entries%ROWTYPE;
  _has_last BOOLEAN;
  _state TEXT;
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

  _state := CASE
    WHEN NOT _has_last OR _last.punched_at <= now() - interval '12 hours' THEN 'closed'
    WHEN _last.entry_type = 'in' THEN 'working'
    WHEN _last.kind = 'break' THEN 'paused'
    ELSE 'closed'
  END;

  IF _action IS NOT NULL THEN
    IF _action NOT IN ('start', 'pause', 'resume', 'stop') THEN
      RAISE EXCEPTION 'Ação inválida';
    END IF;
    _type := CASE WHEN _action IN ('start', 'resume') THEN 'in' ELSE 'out' END;
    _kind := CASE WHEN _action IN ('pause', 'resume') THEN 'break' ELSE 'work' END;

    -- Toque repetido na mesma ação (< 60 s): devolve o registo já feito.
    IF _has_last AND _last.entry_type = _type AND _last.kind = _kind
       AND _last.punched_at > now() - interval '60 seconds' THEN
      RETURN jsonb_build_object('duplicate', true, 'entry', to_jsonb(_last), 'state', _state);
    END IF;

    IF NOT (
      (_action = 'start' AND _state = 'closed')
      OR (_action = 'pause' AND _state = 'working')
      OR (_action = 'resume' AND _state = 'paused')
      OR (_action = 'stop' AND _state IN ('working', 'paused'))
    ) THEN
      RETURN jsonb_build_object(
        'error', 'invalid_state',
        'state', _state,
        'entry', CASE WHEN _has_last THEN to_jsonb(_last) END
      );
    END IF;
  ELSE
    -- Versões antigas da app: Entrada/Saída escolhida ou deduzida, sem pausas.
    IF _has_last AND _last.punched_at > now() - interval '60 seconds' THEN
      RETURN jsonb_build_object('duplicate', true, 'entry', to_jsonb(_last), 'state', _state);
    END IF;
    IF _type IS NULL OR _type NOT IN ('in', 'out') THEN
      _type := CASE
        WHEN _has_last AND _last.entry_type = 'in' AND _last.punched_at > now() - interval '12 hours'
          THEN 'out'
        ELSE 'in'
      END;
    END IF;
  END IF;

  INSERT INTO public.time_clock_entries (
    employee_id, company_id, location_id, tag_id, entry_type, kind, punched_at, source,
    status, flags, latitude, longitude, accuracy_m, distance_m, ip_address,
    ip_country, ip_city, ip_is_proxy, device_id, user_agent, work_mode,
    employee_note, created_by, updated_by
  ) VALUES (
    _employee_id,
    (_payload ->> 'company_id')::uuid,
    NULLIF(_payload ->> 'location_id', '')::uuid,
    NULLIF(_payload ->> 'tag_id', '')::uuid,
    _type,
    _kind,
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

  RETURN jsonb_build_object(
    'duplicate', false,
    'entry', to_jsonb(_new),
    'state', CASE
      WHEN _type = 'in' THEN 'working'
      WHEN _kind = 'break' THEN 'paused'
      ELSE 'closed'
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_register_punch(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.time_clock_register_punch(JSONB) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. "Desfazer" pelo colaborador (último registo, até 3 minutos)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.time_clock_undo_own_entry(_entry_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID := public.get_employee_id_from_user(auth.uid());
  _entry public.time_clock_entries%ROWTYPE;
  _latest UUID;
BEGIN
  SELECT * INTO _entry FROM public.time_clock_entries WHERE id = _entry_id FOR UPDATE;
  IF NOT FOUND OR _employee_id IS NULL OR _entry.employee_id <> _employee_id THEN
    RAISE EXCEPTION 'Registo não encontrado';
  END IF;
  IF _entry.status = 'voided' OR _entry.source NOT IN ('nfc', 'gps') THEN
    RAISE EXCEPTION 'Este registo não pode ser desfeito';
  END IF;
  IF _entry.created_at < now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'Já passaram mais de 3 minutos. Peça a correção aos RH.';
  END IF;

  SELECT id INTO _latest FROM public.time_clock_entries
  WHERE employee_id = _employee_id AND status <> 'voided'
  ORDER BY punched_at DESC LIMIT 1;
  IF _latest <> _entry_id THEN
    RAISE EXCEPTION 'Só é possível desfazer o último registo.';
  END IF;

  PERFORM set_config('app.time_clock_reason', 'Desfeito pelo colaborador logo após o registo', true);
  UPDATE public.time_clock_entries
  SET status = 'voided', updated_by = auth.uid()
  WHERE id = _entry_id;

  RETURN public.time_clock_workday_state(_employee_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_undo_own_entry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_undo_own_entry(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Admin: criar/editar registos também como pausa/retoma (_kind)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.time_clock_admin_create_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.time_clock_admin_create_entry(
  _employee_id UUID,
  _entry_type TEXT,
  _punched_at TIMESTAMPTZ,
  _reason TEXT,
  _location_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _kind TEXT DEFAULT 'work'
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
  IF COALESCE(_kind, 'work') NOT IN ('work', 'break') THEN
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
    employee_id, company_id, location_id, entry_type, kind, punched_at,
    source, status, notes, created_by, updated_by
  ) VALUES (
    _employee_id, _company_id, _location_id, _entry_type, COALESCE(_kind, 'work'), _punched_at,
    'admin', 'valid', NULLIF(trim(COALESCE(_notes, '')), ''), auth.uid(), auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_admin_create_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_admin_create_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.time_clock_admin_update_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.time_clock_admin_update_entry(
  _entry_id UUID,
  _entry_type TEXT,
  _punched_at TIMESTAMPTZ,
  _reason TEXT,
  _notes TEXT DEFAULT NULL,
  _kind TEXT DEFAULT NULL
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
  IF _kind IS NOT NULL AND _kind NOT IN ('work', 'break') THEN
    RAISE EXCEPTION 'Tipo de registo inválido';
  END IF;
  IF _punched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Não é possível registar horas no futuro';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  UPDATE public.time_clock_entries
  SET entry_type = _entry_type,
      kind = COALESCE(_kind, kind),
      punched_at = _punched_at,
      notes = NULLIF(trim(COALESCE(_notes, '')), ''),
      updated_by = auth.uid()
  WHERE id = _entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_admin_update_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_admin_update_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
