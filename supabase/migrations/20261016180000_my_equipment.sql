-- Realize 2.0 · Ficha do colaborador: equipamentos e telemóveis atribuídos a quem pergunta.
-- As tabelas são só de admin (RLS); esta função devolve apenas o que é da própria pessoa e
-- sem dados sensíveis (PIN/PUK dos cartões ficam de fora).

CREATE OR REPLACE FUNCTION public.my_equipment()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id FROM employees WHERE user_id = auth.uid() AND is_active LIMIT 1
  )
  SELECT jsonb_build_object(
    'equipments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', eq.id,
               'category', c.name,
               'brand', eq.brand,
               'model', eq.model,
               'serial', eq.serial_number,
               'number', eq.equipment_number,
               'color', eq.color,
               'status', eq.status
             ) ORDER BY c.name, eq.brand)
      FROM equipments eq
      LEFT JOIN equipment_categories c ON c.id = eq.category_id
      WHERE eq.employee_id = (SELECT id FROM me)), '[]'::jsonb),
    'phones', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id,
               'number', p.phone_number,
               'operator', p.operator,
               'label', p.label
             ) ORDER BY p.phone_number)
      FROM phones p
      WHERE p.employee_id = (SELECT id FROM me)), '[]'::jsonb),
    'keys', (
      SELECT a.keys_count FROM assignments a
      WHERE a.employee_id = (SELECT id FROM me) AND a.return_date IS NULL
      ORDER BY a.assigned_date DESC NULLS LAST LIMIT 1)
  );
$$;
REVOKE ALL ON FUNCTION public.my_equipment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_equipment() TO authenticated;
