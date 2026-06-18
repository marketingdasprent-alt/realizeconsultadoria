-- Fix: employees could not upload their own documents because the storage
-- INSERT policy that allowed writing to their "<employeeId>/..." folder in the
-- 'employee-files' bucket was dropped by a later migration (only an
-- absence-documents upload policy remained). Without it, the file upload that
-- precedes the employee_documents insert fails with an RLS violation.
--
-- This recreates an INSERT policy mirroring the existing
-- "Employees can view own files" SELECT policy: the first path segment must be
-- the id of an employee row owned by the current user.

DROP POLICY IF EXISTS "Employees can upload own files" ON storage.objects;

CREATE POLICY "Employees can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Allow employees to delete files they uploaded to their own folder, so the
-- "remove" call in the UI (which deletes the storage object before the row)
-- succeeds for self-submitted documents.
DROP POLICY IF EXISTS "Employees can delete own files" ON storage.objects;

CREATE POLICY "Employees can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'employee-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.employees WHERE user_id = auth.uid()
    )
  );
