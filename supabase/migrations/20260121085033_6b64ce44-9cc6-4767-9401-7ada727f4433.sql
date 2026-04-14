-- Create table for support ticket subjects
CREATE TABLE public.support_ticket_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_ticket_subjects ENABLE ROW LEVEL SECURITY;

-- Admins can manage all subjects
CREATE POLICY "Admins can manage all subjects"
ON public.support_ticket_subjects
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view active subjects
CREATE POLICY "Authenticated users can view active subjects"
ON public.support_ticket_subjects
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_support_ticket_subjects_updated_at
BEFORE UPDATE ON public.support_ticket_subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial subjects
INSERT INTO public.support_ticket_subjects (label, sort_order) VALUES
  ('Problema com acesso/login', 1),
  ('Dúvida sobre férias', 2),
  ('Erro na aplicação', 3),
  ('Alteração de dados pessoais', 4),
  ('Outro', 5);