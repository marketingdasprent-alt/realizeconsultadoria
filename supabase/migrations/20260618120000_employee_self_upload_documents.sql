-- Allow employees to submit their own documents in the "Meus Documentos" area.
-- Documents about the employee uploaded by the company stay read-only for the
-- employee; documents the employee submits themselves can be inserted and
-- removed by that same employee. We also record WHO submitted each document in
-- a human-readable way so the UI can show "Submetido por: <nome> (<origem>)".

-- 1. Authorship columns (kept text/nullable so existing rows remain valid).
--    uploaded_by_role: 'admin' for company uploads, 'employee' for self uploads.
--    uploaded_by_name: display name captured at upload time (no auth.users join
--    needed on the client, which cannot read that table directly).
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS uploaded_by_role TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;

-- 2. Let employees INSERT documents for their own employee record.
--    WITH CHECK ties the row to the caller's employee id and forces the
--    self-upload marker so an employee cannot impersonate a company upload.
DROP POLICY IF EXISTS "Employees can insert own documents" ON public.employee_documents;

CREATE POLICY "Employees can insert own documents"
  ON public.employee_documents FOR INSERT
  WITH CHECK (
    employee_id = public.get_employee_id_from_user(auth.uid())
    AND uploaded_by_role = 'employee'
    AND uploaded_by = auth.uid()
  );

-- 3. Let employees DELETE only the documents they submitted themselves.
--    Company-uploaded documents (uploaded_by_role IS DISTINCT FROM 'employee')
--    remain untouchable by the employee.
DROP POLICY IF EXISTS "Employees can delete own submitted documents" ON public.employee_documents;

CREATE POLICY "Employees can delete own submitted documents"
  ON public.employee_documents FOR DELETE
  USING (
    employee_id = public.get_employee_id_from_user(auth.uid())
    AND uploaded_by_role = 'employee'
    AND uploaded_by = auth.uid()
  );

-- Note: storage policies already allow an employee to upload to and read from
-- their own "<employeeId>/..." folder in the 'employee-files' bucket
-- (see 20260126120929), and admins keep full FOR ALL access to documents, so
-- no additional storage or admin policy changes are required here.
