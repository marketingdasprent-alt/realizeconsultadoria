-- Permitir colaboradores deletarem os seus próprios pedidos pendentes
CREATE POLICY "Employees can delete own pending absences"
ON public.absences
FOR DELETE
TO authenticated
USING (
  (employee_id IN (
    SELECT employees.id FROM employees 
    WHERE employees.user_id = auth.uid()
  ))
  AND status = 'pending'
);

-- Permitir delete de períodos de ausências pendentes próprias
CREATE POLICY "Employees can delete own pending absence periods"
ON public.absence_periods
FOR DELETE
TO authenticated
USING (
  absence_id IN (
    SELECT absences.id FROM absences
    WHERE absences.employee_id IN (
      SELECT employees.id FROM employees 
      WHERE employees.user_id = auth.uid()
    )
    AND absences.status = 'pending'
  )
);

-- Permitir delete de documentos de ausências pendentes próprias
CREATE POLICY "Employees can delete own pending absence documents"
ON public.absence_documents
FOR DELETE
TO authenticated
USING (
  absence_id IN (
    SELECT absences.id FROM absences
    WHERE absences.employee_id IN (
      SELECT employees.id FROM employees 
      WHERE employees.user_id = auth.uid()
    )
    AND absences.status = 'pending'
  )
);