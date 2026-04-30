-- Create storage bucket for legal documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal_documents', 'legal_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Users can upload legal documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'legal_documents');

CREATE POLICY "Users can view legal documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'legal_documents');

CREATE POLICY "Users can delete legal documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'legal_documents');

-- Create the table for legal client documents metadata
CREATE TABLE IF NOT EXISTS public.legal_client_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.legal_clients(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.legal_client_documents ENABLE ROW LEVEL SECURITY;

-- Creating permissive policy for testing (consistent with legal_installments)
CREATE POLICY "Enable all for authenticated users" ON public.legal_client_documents
    FOR ALL USING (auth.role() = 'authenticated');
