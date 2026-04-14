
-- Migrate existing equipment assignments to the new assignments system
-- Skip employees who already have assignments (e.g., Carmelita)

-- Step 1: Create assignment records for each employee with equipment
INSERT INTO assignments (employee_id, company_id, status, assigned_date)
SELECT DISTINCT e.id, e.company_id, 'active', CURRENT_DATE
FROM employees e
JOIN equipments eq ON eq.employee_id = e.id
WHERE NOT EXISTS (
  SELECT 1 FROM assignments a WHERE a.employee_id = e.id
);

-- Step 2: Create assignment_items for each equipment
-- For phones (telemóveis), match SIM card via employee_id
INSERT INTO assignment_items (assignment_id, equipment_id, phone_id)
SELECT 
  a.id,
  eq.id,
  -- Match SIM: if equipment is a phone category, find first available SIM for same employee
  CASE 
    WHEN ec.name ILIKE '%telemóvel%' OR ec.name ILIKE '%telemovel%' OR ec.name ILIKE '%phone%' THEN (
      SELECT p.id 
      FROM phones p 
      WHERE p.employee_id = eq.employee_id 
      LIMIT 1
    )
    ELSE NULL
  END
FROM equipments eq
JOIN assignments a ON a.employee_id = eq.employee_id
JOIN employees e ON e.id = eq.employee_id
LEFT JOIN equipment_categories ec ON ec.id = eq.category_id
WHERE eq.employee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM assignment_items ai WHERE ai.equipment_id = eq.id AND ai.assignment_id = a.id
  );
