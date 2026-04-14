-- Atualizar função recalculate_vacation_used_days para usar 'vacation' em vez de 'ferias'
CREATE OR REPLACE FUNCTION public.recalculate_vacation_used_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_employee_id uuid;
  target_year integer;
  total_used numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_employee_id := OLD.employee_id;
    target_year := EXTRACT(YEAR FROM OLD.start_date)::integer;
  ELSE
    target_employee_id := NEW.employee_id;
    target_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
  END IF;
  
  -- CORREÇÃO: Mudar 'ferias' para 'vacation'
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
$$;

-- Atualizar função recalculate_vacation_from_period para usar 'vacation' em vez de 'ferias'
CREATE OR REPLACE FUNCTION public.recalculate_vacation_from_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_employee_id uuid;
  target_year integer;
  total_used numeric;
  abs_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    abs_id := OLD.absence_id;
    target_year := EXTRACT(YEAR FROM OLD.start_date)::integer;
  ELSE
    abs_id := NEW.absence_id;
    target_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
  END IF;
  
  SELECT employee_id INTO target_employee_id
  FROM absences WHERE id = abs_id;
  
  IF target_employee_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- CORREÇÃO: Mudar 'ferias' para 'vacation'
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
$$;