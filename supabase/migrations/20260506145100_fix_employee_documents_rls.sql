-- Fix RLS policies for employee documents and attachments
-- The previous policies were missing the `public.` prefix for `has_role` and table references
-- and missing `WITH CHECK` clauses, causing RLS violations during inserts.

-- 1. Fix employee_documents
DROP POLICY IF EXISTS "Admins can manage employee documents" ON public.employee_documents;

CREATE POLICY "Admins can manage employee documents"
  ON public.employee_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix employee_attachments
DROP POLICY IF EXISTS "Admins can manage employee attachments" ON public.employee_attachments;

CREATE POLICY "Admins can manage employee attachments"
  ON public.employee_attachments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix storage policies for admins
DROP POLICY IF EXISTS "Admins can manage all employee files" ON storage.objects;

CREATE POLICY "Admins can manage all employee files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'employee-files' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'employee-files' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix storage policies for employees (missing public. prefixes in subqueries)
DROP POLICY IF EXISTS "Employees can view own files" ON storage.objects;

CREATE POLICY "Employees can view own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'employee-files'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.employees WHERE user_id = auth.uid()
    )
    OR
    name IN (
      SELECT ed.file_path FROM public.employee_documents ed
      WHERE ed.employee_id = public.get_employee_id_from_user(auth.uid())
    )
  )
);
