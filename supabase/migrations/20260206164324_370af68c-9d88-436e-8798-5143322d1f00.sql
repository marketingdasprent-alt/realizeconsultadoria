-- Create phones table for mobile phone management
CREATE TABLE public.phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  pin text,
  puk text,
  operator text,
  label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can manage phones
CREATE POLICY "Admins can manage all phones"
  ON public.phones FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_phones_updated_at
  BEFORE UPDATE ON public.phones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();