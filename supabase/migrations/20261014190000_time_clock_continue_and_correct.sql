-- =============================================================================
-- Ponto: "Retomar dia", correção de hora (✎) e morada do registo
-- =============================================================================
-- 1. Retomar dia: carregou em "Terminar dia" (ou a saída para o almoço ficou gravada
--    como fim do dia) e voltou no mesmo dia → o fim passa a pausa e regista-se a
--    retoma, como o "Continuar dia de trabalho" do Bitrix24.
-- 2. Correção de hora: o colaborador indica a hora de um registo esquecido (ex.:
--    voltou do almoço às 14:00 e só se lembrou às 17:00). A edge function grava-o
--    como 'pending' com a flag manual_time; aqui valida-se a hora.
-- 3. Morada: rua e localidade aproximadas do GPS (OpenStreetMap), para mostrar onde a
--    pessoa estava quando o registo não foi feito num local de trabalho.
-- Os toques repetidos passam a contar pela hora de gravação (created_at), porque a
-- hora do registo pode ser a indicada pelo colaborador. Não altera dados existentes.
-- Pode correr mais do que uma vez.

-- -----------------------------------------------------------------------------
-- 1. Morada aproximada
-- -----------------------------------------------------------------------------
ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.time_clock_entries
  DROP CONSTRAINT IF EXISTS time_clock_entries_address_length;
ALTER TABLE public.time_clock_entries
  ADD CONSTRAINT time_clock_entries_address_length
  CHECK (address IS NULL OR char_length(address) <= 200);

COMMENT ON COLUMN public.time_clock_entries.address IS
  'Morada aproximada (rua, localidade) a partir do GPS, via OpenStreetMap (Nominatim).';

-- -----------------------------------------------------------------------------
-- 2. Registo atómico: Retomar dia + hora indicada + morada
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
  _at TIMESTAMPTZ := NULLIF(_payload ->> 'punched_at', '')::timestamptz;
  _last public.time_clock_entries%ROWTYPE;
  _has_last BOOLEAN;
  _state TEXT;
  _continue BOOLEAN := false;
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

    -- Toque repetido na mesma ação (gravada há < 60 s): devolve o registo já feito.
    IF _has_last AND _last.entry_type = _type AND _last.kind = _kind
       AND _last.created_at > now() - interval '60 seconds' THEN
      RETURN jsonb_build_object('duplicate', true, 'entry', to_jsonb(_last), 'state', _state);
    END IF;

    -- Retomar dia: o último registo é o fim do dia de hoje (hora de Lisboa).
    _continue := _action = 'resume' AND _state = 'closed' AND _has_last
      AND _last.entry_type = 'out' AND _last.kind = 'work'
      AND _last.punched_at > now() - interval '12 hours'
      AND (_last.punched_at AT TIME ZONE 'Europe/Lisbon')::date
        = (now() AT TIME ZONE 'Europe/Lisbon')::date;

    IF NOT (
      (_action = 'start' AND _state = 'closed')
      OR (_action = 'pause' AND _state = 'working')
      OR (_action = 'resume' AND (_state = 'paused' OR _continue))
      OR (_action = 'stop' AND _state IN ('working', 'paused'))
    ) THEN
      RETURN jsonb_build_object(
        'error', 'invalid_state',
        'state', _state,
        'entry', CASE WHEN _has_last THEN to_jsonb(_last) END
      );
    END IF;

    -- Hora indicada: depois do último registo, nas últimas 12 h e não no futuro.
    IF _at IS NOT NULL AND (
      _at > now() + interval '1 minute'
      OR _at < now() - interval '12 hours'
      OR (_has_last AND _at <= _last.punched_at)
    ) THEN
      RETURN jsonb_build_object(
        'error', 'invalid_time',
        'state', _state,
        'entry', CASE WHEN _has_last THEN to_jsonb(_last) END
      );
    END IF;

    IF _continue THEN
      PERFORM set_config(
        'app.time_clock_reason', 'Dia retomado pelo colaborador: o fim do dia passou a pausa', true
      );
      UPDATE public.time_clock_entries
      SET kind = 'break', updated_by = (_payload ->> 'user_id')::uuid
      WHERE id = _last.id;
    END IF;
  ELSE
    -- Versões antigas da app: Entrada/Saída escolhida ou deduzida, sem pausas nem hora.
    _at := NULL;
    IF _has_last AND _last.created_at > now() - interval '60 seconds' THEN
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

  PERFORM set_config(
    'app.time_clock_reason',
    CASE WHEN _at IS NOT NULL THEN 'Hora indicada pelo colaborador' ELSE '' END,
    true
  );

  INSERT INTO public.time_clock_entries (
    employee_id, company_id, location_id, tag_id, entry_type, kind, punched_at, source,
    status, flags, latitude, longitude, accuracy_m, distance_m, address, ip_address,
    ip_country, ip_city, ip_is_proxy, device_id, user_agent, work_mode,
    employee_note, created_by, updated_by
  ) VALUES (
    _employee_id,
    (_payload ->> 'company_id')::uuid,
    NULLIF(_payload ->> 'location_id', '')::uuid,
    NULLIF(_payload ->> 'tag_id', '')::uuid,
    _type,
    _kind,
    COALESCE(_at, now()),
    _payload ->> 'source',
    COALESCE(_payload ->> 'status', 'valid'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload -> 'flags')), '{}'),
    (_payload ->> 'latitude')::double precision,
    (_payload ->> 'longitude')::double precision,
    (_payload ->> 'accuracy_m')::double precision,
    (_payload ->> 'distance_m')::double precision,
    NULLIF(left(trim(COALESCE(_payload ->> 'address', '')), 200), ''),
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
