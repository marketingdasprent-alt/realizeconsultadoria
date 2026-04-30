-- Add Jurídico to support_departments
INSERT INTO support_departments (name, is_active, sort_order)
SELECT 'Jurídico', true, 10
WHERE NOT EXISTS (SELECT 1 FROM support_departments WHERE name = 'Jurídico');

-- Update Dinis Silva Assunção's department in employees table
-- Using name match from profiles to get the user_id and update the corresponding employee record
UPDATE employees
SET department = 'Jurídico'
WHERE user_id IN (
  SELECT user_id FROM profiles WHERE name ILIKE '%Dinis Silva Assunção%'
) OR name ILIKE '%Dinis Silva Assunção%';
