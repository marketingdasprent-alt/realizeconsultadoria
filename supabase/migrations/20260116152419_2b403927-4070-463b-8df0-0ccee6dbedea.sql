-- Add self_schedulable_days to employee_vacation_balances
-- NULL means employee can schedule all available days
ALTER TABLE employee_vacation_balances 
ADD COLUMN self_schedulable_days numeric DEFAULT NULL;

-- Add created_by_role to absences to track who created the absence
ALTER TABLE absences 
ADD COLUMN created_by_role text DEFAULT 'employee';

-- Add comment for clarity
COMMENT ON COLUMN employee_vacation_balances.self_schedulable_days IS 'Days the employee can self-schedule. NULL means all available days.';
COMMENT ON COLUMN absences.created_by_role IS 'Who created the absence: employee or admin';