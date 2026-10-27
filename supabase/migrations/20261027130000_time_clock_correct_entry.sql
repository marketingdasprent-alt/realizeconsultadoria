-- Ponto: corrigir a hora de um registo já feito (ex.: a entrada ficou às 10:24 porque a app
-- não funcionou, e foi às 09:10). O colaborador indica a hora e o motivo; o registo fica
-- 'pending' com a flag manual_time para os RH confirmarem. O histórico guarda a hora antiga
-- (trigger trg_time_clock_entries_history). Só registos próprios, das últimas 12 horas, e a
-- nova hora tem de ficar entre o registo anterior e o seguinte.
CREATE OR REPLACE FUNCTION public.time_clock_correct_entry(
  _entry_id uuid,
  _at timestamptz,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.get_employee_id_from_user(auth.uid());
  _entry public.time_clock_entries%ROWTYPE;
  _prev timestamptz;
  _next timestamptz;
  _note text := btrim(coalesce(_reason, ''));
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Esta conta não está associada a um colaborador.';
  END IF;
  IF char_length(_note) < 3 THEN
    RAISE EXCEPTION 'Escreva o motivo da correção.';
  END IF;
  IF char_length(_note) > 300 THEN
    RAISE EXCEPTION 'O motivo é demasiado longo.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('time_clock:' || _me::text, 0));

  SELECT * INTO _entry FROM public.time_clock_entries
  WHERE id = _entry_id AND employee_id = _me AND status <> 'voided';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registo não encontrado.';
  END IF;
  IF _entry.punched_at < now() - interval '12 hours' OR _at < now() - interval '12 hours' THEN
    RAISE EXCEPTION 'Só é possível corrigir as últimas 12 horas. Fale com os RH.';
  END IF;
  IF _at > now() THEN
    RAISE EXCEPTION 'A hora não pode ser no futuro.';
  END IF;

  SELECT max(punched_at) INTO _prev FROM public.time_clock_entries
  WHERE employee_id = _me AND status <> 'voided' AND id <> _entry_id
    AND punched_at < _entry.punched_at;
  SELECT min(punched_at) INTO _next FROM public.time_clock_entries
  WHERE employee_id = _me AND status <> 'voided' AND id <> _entry_id
    AND punched_at > _entry.punched_at;
  IF _prev IS NOT NULL AND _at <= _prev THEN
    RAISE EXCEPTION 'Tem de ser depois do registo anterior (%).',
      to_char(_prev AT TIME ZONE 'Europe/Lisbon', 'HH24:MI');
  END IF;
  IF _next IS NOT NULL AND _at >= _next THEN
    RAISE EXCEPTION 'Tem de ser antes do registo seguinte (%).',
      to_char(_next AT TIME ZONE 'Europe/Lisbon', 'HH24:MI');
  END IF;

  UPDATE public.time_clock_entries
  SET punched_at = _at,
      status = 'pending',
      flags = CASE WHEN 'manual_time' = ANY (flags) THEN flags ELSE array_append(flags, 'manual_time'::text) END,
      employee_note = _note,
      updated_by = auth.uid()
  WHERE id = _entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.time_clock_correct_entry(uuid, timestamptz, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.time_clock_correct_entry(uuid, timestamptz, text) TO authenticated;
