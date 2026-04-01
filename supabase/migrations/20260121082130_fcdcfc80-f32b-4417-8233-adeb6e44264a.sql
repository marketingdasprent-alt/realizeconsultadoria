-- Create storage bucket for absence documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'absence-documents',
  'absence-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- Create table for document metadata
CREATE TABLE public.absence_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  absence_id UUID NOT NULL REFERENCES public.absences(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.absence_documents ENABLE ROW LEVEL SECURITY;

-- Employees can insert documents for their own absences
CREATE POLICY "Employees can insert documents for own absences"
ON public.absence_documents
FOR INSERT
WITH CHECK (
  absence_id IN (
    SELECT a.id FROM absences a
    JOIN employees e ON e.id = a.employee_id
    WHERE e.user_id = auth.uid()
  )
);

-- Employees can view documents for their own absences
CREATE POLICY "Employees can view own absence documents"
ON public.absence_documents
FOR SELECT
USING (
  absence_id IN (
    SELECT a.id FROM absences a
    JOIN employees e ON e.id = a.employee_id
    WHERE e.user_id = auth.uid()
  )
);

-- Admins can view all documents
CREATE POLICY "Admins can view all absence documents"
ON public.absence_documents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all documents
CREATE POLICY "Admins can manage all absence documents"
ON public.absence_documents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for absence-documents bucket
CREATE POLICY "Employees can upload to own absence folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'absence-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Employees can view their own documents
CREATE POLICY "Employees can view own absence documents in storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'absence-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all documents in storage
CREATE POLICY "Admins can view all absence documents in storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'absence-documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can manage all documents in storage
CREATE POLICY "Admins can manage all absence documents in storage"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'absence-documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);