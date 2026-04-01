CREATE POLICY "Employees can view own documents"
  ON public.employee_documents
  FOR SELECT
  USING (
    employee_id = get_employee_id_from_user(auth.uid())
  );