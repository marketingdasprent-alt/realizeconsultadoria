
-- Drop the existing combined trigger
DROP TRIGGER IF EXISTS sync_vacation_on_absence_change ON public.absences;

-- Create separate triggers for INSERT, UPDATE, DELETE with proper WHEN clauses
CREATE TRIGGER sync_vacation_on_absence_insert
  AFTER INSERT ON public.absences
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND NEW.absence_type = 'vacation')
  EXECUTE FUNCTION recalculate_vacation_used_days();

CREATE TRIGGER sync_vacation_on_absence_update
  AFTER UPDATE ON public.absences
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND (OLD.absence_type = 'vacation' OR NEW.absence_type = 'vacation'))
  EXECUTE FUNCTION recalculate_vacation_used_days();

CREATE TRIGGER sync_vacation_on_absence_delete
  AFTER DELETE ON public.absences
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND OLD.absence_type = 'vacation')
  EXECUTE FUNCTION recalculate_vacation_used_days();

-- Update recalculate_vacation_from_period with early-return for non-vacation
CREATE OR REPLACE FUNCTION public.recalculate_vacation_from_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_employee_id uuid;
  target_year integer;
  total_used numeric;
  abs_id uuid;
  absence_type_val text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    abs_id := OLD.absence_id;
    target_year := EXTRACT(YEAR FROM OLD.start_date)::integer;
  ELSE
    abs_id := NEW.absence_id;
    target_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
  END IF;

  -- Early return: only process vacation absences
  SELECT a.absence_type, a.employee_id INTO absence_type_val, target_employee_id
  FROM absences a WHERE a.id = abs_id;

  IF absence_type_val IS NULL OR absence_type_val != 'vacation' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF target_employee_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(ap.business_days), 0)
  INTO total_used
  FROM absences a
  JOIN absence_periods ap ON ap.absence_id = a.id
  WHERE a.employee_id = target_employee_id
    AND a.status = 'approved'
    AND a.absence_type = 'vacation'
    AND ap.status = 'approved'
    AND EXTRACT(YEAR FROM ap.start_date) = target_year;

  UPDATE employee_vacation_balances
  SET used_days = total_used, updated_at = now()
  WHERE employee_id = target_employee_id AND year = target_year;

  IF NOT FOUND THEN
    INSERT INTO employee_vacation_balances (employee_id, year, used_days, total_days)
    VALUES (target_employee_id, target_year, total_used, 22)
    ON CONFLICT (employee_id, year) DO UPDATE SET used_days = total_used, updated_at = now();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
