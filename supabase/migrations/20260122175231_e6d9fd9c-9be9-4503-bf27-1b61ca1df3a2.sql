-- Drop existing DELETE policies for pending-only
DROP POLICY IF EXISTS "Employees can delete own pending absences" ON absences;
DROP POLICY IF EXISTS "Employees can delete own pending absence periods" ON absence_periods;
DROP POLICY IF EXISTS "Employees can delete own pending absence documents" ON absence_documents;

-- Create new policies that allow deletion for both pending and rejected status

-- Policy for absences table
CREATE POLICY "Employees can delete own pending or rejected absences"
ON absences FOR DELETE TO authenticated
USING (
  employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
  AND status IN ('pending', 'rejected')
);

-- Policy for absence_periods table
CREATE POLICY "Employees can delete own pending or rejected absence periods"
ON absence_periods FOR DELETE TO authenticated
USING (
  absence_id IN (
    SELECT id FROM absences
    WHERE employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    AND status IN ('pending', 'rejected')
  )
);

-- Policy for absence_documents table
CREATE POLICY "Employees can delete own pending or rejected absence documents"
ON absence_documents FOR DELETE TO authenticated
USING (
  absence_id IN (
    SELECT id FROM absences
    WHERE employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    AND status IN ('pending', 'rejected')
  )
);