-- A morada aproximada (OpenStreetMap) passa a ser gravada em segundo plano, depois do
-- registo: não é uma alteração do registo, por isso não entra no histórico.
CREATE OR REPLACE FUNCTION public.log_time_clock_entry_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE k NOT IN ('updated_at', 'updated_by', 'address')
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
$function$;
