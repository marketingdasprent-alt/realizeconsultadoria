-- =============================================================================
-- Ponto: o colaborador escolhe Entrada ou Saída e pode deixar observações
-- =============================================================================
-- Antes o tipo era deduzido do último registo: uma picagem esquecida (ex.: saída
-- para almoço) invertia todas as seguintes do dia. Agora a app envia o tipo
-- escolhido (com confirmação) e a base respeita-o; sem tipo, mantém a dedução.
-- Também guarda a observação do colaborador em qualquer registo (limite 300).
-- Não altera dados existentes. Pode correr mais do que uma vez.

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
  _type TEXT := _payload ->> 'entry_type';
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

  -- O colaborador escolhe Entrada/Saída. Só se não vier (versões antigas da app)
  -- é que se deduz do último registo.
  IF _type IS NULL OR _type NOT IN ('in', 'out') THEN
    _type := CASE
      WHEN _has_last AND _last.entry_type = 'in' AND _last.punched_at > now() - interval '12 hours'
        THEN 'out'
      ELSE 'in'
    END;
  END IF;

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
-- Observações do colaborador em qualquer registo (antes só nos remotos)
-- -----------------------------------------------------------------------------
-- A app passa a ter o campo "Observações" em todos os registos (ex.: "esqueci-me
-- de picar a saída do almoço às 13h"). Fica no registo, no histórico, no email
-- de aprovação e na folha impressa. Só o colaborador a escreve, ao picar.
COMMENT ON COLUMN public.time_clock_entries.employee_note IS
  'Observação escrita pelo colaborador ao registar o ponto (máx. 300 caracteres).';

ALTER TABLE public.time_clock_entries
  DROP CONSTRAINT IF EXISTS time_clock_entries_employee_note_length;
ALTER TABLE public.time_clock_entries
  ADD CONSTRAINT time_clock_entries_employee_note_length
  CHECK (employee_note IS NULL OR char_length(employee_note) <= 300);
