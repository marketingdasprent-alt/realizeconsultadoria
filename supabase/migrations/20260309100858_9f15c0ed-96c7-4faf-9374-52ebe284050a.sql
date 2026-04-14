-- Create assignments table
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  return_date date,
  keys_count integer,
  keys_locations text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create assignment_items table
CREATE TABLE public.assignment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  phone_id uuid REFERENCES public.phones(id) ON DELETE SET NULL,
  has_charger boolean NOT NULL DEFAULT false,
  has_case boolean NOT NULL DEFAULT false,
  has_screen_protector boolean NOT NULL DEFAULT false,
  has_bag boolean NOT NULL DEFAULT false,
  has_mouse_pad boolean NOT NULL DEFAULT false,
  has_keyboard boolean NOT NULL DEFAULT false,
  has_mouse boolean NOT NULL DEFAULT false,
  has_pen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add status column to equipments
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available';

-- Update existing equipments: those with employee_id are "assigned"
UPDATE public.equipments SET status = 'assigned' WHERE employee_id IS NOT NULL;
UPDATE public.equipments SET status = 'available' WHERE employee_id IS NULL;

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignments
CREATE POLICY "Admins can manage all assignments"
  ON public.assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for assignment_items
CREATE POLICY "Admins can manage all assignment items"
  ON public.assignment_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger for assignments
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();