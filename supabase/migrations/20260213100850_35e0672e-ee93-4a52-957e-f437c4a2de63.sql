
-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false);

-- Storage policies: employees can upload to their own tickets
CREATE POLICY "Employees can upload ticket attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
);

-- Storage policies: authenticated users can read ticket attachments
CREATE POLICY "Authenticated users can read ticket attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments'
);

-- Create support_ticket_attachments table
CREATE TABLE public.support_ticket_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: employee who owns the ticket OR admin
CREATE POLICY "Employees can view own ticket attachments"
ON public.support_ticket_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    JOIN public.employees e ON e.id = st.employee_id
    WHERE st.id = ticket_id AND e.user_id = auth.uid()
  )
  OR
  public.has_role(auth.uid(), 'admin')
);

-- INSERT: authenticated employees
CREATE POLICY "Employees can insert ticket attachments"
ON public.support_ticket_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
);
