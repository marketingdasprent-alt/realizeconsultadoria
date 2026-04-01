
DROP POLICY IF EXISTS "Employees can view own files" ON storage.objects;

CREATE POLICY "Employees can view own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'employee-files'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM employees WHERE user_id = auth.uid()
    )
    OR
    name IN (
      SELECT ed.file_path FROM employee_documents ed
      WHERE ed.employee_id = get_employee_id_from_user(auth.uid())
    )
  )
);
