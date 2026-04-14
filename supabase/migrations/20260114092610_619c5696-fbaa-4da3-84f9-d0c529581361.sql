-- Parte 1: Resetar todos os used_days para 0 em 2026
UPDATE employee_vacation_balances 
SET used_days = 0, updated_at = now()
WHERE year = 2026;

-- Parte 2: Criar função para recalcular used_days baseado nas ausências aprovadas
CREATE OR REPLACE FUNCTION public.recalculate_vacation_used_days()
RETURNS TRIGGER AS $$
DECLARE
  target_employee_id uuid;
  target_year integer;
  total_used integer;
BEGIN
  -- Determinar o employee_id afetado
  IF TG_OP = 'DELETE' THEN
    target_employee_id := OLD.employee_id;
    target_year := EXTRACT(YEAR FROM OLD.start_date)::integer;
  ELSE
    target_employee_id := NEW.employee_id;
    target_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
  END IF;
  
  -- Calcular total de dias de férias aprovados
  SELECT COALESCE(SUM(ap.business_days), 0)
  INTO total_used
  FROM absences a
  JOIN absence_periods ap ON ap.absence_id = a.id
  WHERE a.employee_id = target_employee_id
    AND a.status = 'approved'
    AND a.absence_type = 'ferias'
    AND ap.status = 'approved'
    AND EXTRACT(YEAR FROM ap.start_date) = target_year;
  
  -- Atualizar o saldo de férias
  UPDATE employee_vacation_balances
  SET used_days = total_used, updated_at = now()
  WHERE employee_id = target_employee_id AND year = target_year;
  
  -- Se não existir registo, criar um
  IF NOT FOUND THEN
    INSERT INTO employee_vacation_balances (employee_id, year, used_days, total_days)
    VALUES (target_employee_id, target_year, total_used, 22)
    ON CONFLICT (employee_id, year) DO UPDATE SET used_days = total_used, updated_at = now();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Parte 3: Criar função para recalcular a partir de mudanças nos períodos
CREATE OR REPLACE FUNCTION public.recalculate_vacation_from_period()
RETURNS TRIGGER AS $$
DECLARE
  target_employee_id uuid;
  target_year integer;
  total_used integer;
  abs_id uuid;
BEGIN
  -- Determinar o absence_id afetado
  IF TG_OP = 'DELETE' THEN
    abs_id := OLD.absence_id;
    target_year := EXTRACT(YEAR FROM OLD.start_date)::integer;
  ELSE
    abs_id := NEW.absence_id;
    target_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
  END IF;
  
  -- Obter o employee_id da ausência
  SELECT employee_id INTO target_employee_id
  FROM absences WHERE id = abs_id;
  
  IF target_employee_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calcular total de dias de férias aprovados
  SELECT COALESCE(SUM(ap.business_days), 0)
  INTO total_used
  FROM absences a
  JOIN absence_periods ap ON ap.absence_id = a.id
  WHERE a.employee_id = target_employee_id
    AND a.status = 'approved'
    AND a.absence_type = 'ferias'
    AND ap.status = 'approved'
    AND EXTRACT(YEAR FROM ap.start_date) = target_year;
  
  -- Atualizar o saldo de férias
  UPDATE employee_vacation_balances
  SET used_days = total_used, updated_at = now()
  WHERE employee_id = target_employee_id AND year = target_year;
  
  -- Se não existir registo, criar um
  IF NOT FOUND THEN
    INSERT INTO employee_vacation_balances (employee_id, year, used_days, total_days)
    VALUES (target_employee_id, target_year, total_used, 22)
    ON CONFLICT (employee_id, year) DO UPDATE SET used_days = total_used, updated_at = now();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Parte 4: Criar triggers
CREATE TRIGGER sync_vacation_on_absence_change
  AFTER INSERT OR UPDATE OR DELETE ON absences
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION recalculate_vacation_used_days();

CREATE TRIGGER sync_vacation_on_period_change
  AFTER INSERT OR UPDATE OR DELETE ON absence_periods
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION recalculate_vacation_from_period();