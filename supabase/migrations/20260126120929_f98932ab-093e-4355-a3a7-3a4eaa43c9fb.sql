-- Create employee_documents table (company-uploaded documents about the employee)
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create employee_attachments table (employee-submitted files + admin manual uploads)
CREATE TABLE public.employee_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'employee',
  description TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attachments ENABLE ROW LEVEL SECURITY;

-- RLS for employee_documents (admins only)
CREATE POLICY "Admins can manage employee documents"
ON public.employee_documents FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for employee_attachments
CREATE POLICY "Admins can manage employee attachments"
ON public.employee_attachments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view own attachments"
ON public.employee_attachments FOR SELECT
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can insert own attachments"
ON public.employee_attachments FOR INSERT
WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Create storage bucket for employee files
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-files', 'employee-files', false);

-- Storage policies for employee-files bucket
CREATE POLICY "Admins can manage all employee files"
ON storage.objects FOR ALL
USING (bucket_id = 'employee-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employees can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_employee_documents_employee_id ON public.employee_documents(employee_id);
CREATE INDEX idx_employee_attachments_employee_id ON public.employee_attachments(employee_id);