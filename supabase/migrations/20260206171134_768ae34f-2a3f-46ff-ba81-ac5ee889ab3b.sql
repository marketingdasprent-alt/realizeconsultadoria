-- Criar tabela de categorias de equipamentos
CREATE TABLE public.equipment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;

-- Policy para super admins
CREATE POLICY "Super admins can manage equipment categories"
  ON public.equipment_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = auth.uid() AND ag.is_super_admin = true
  ));

-- Criar tabela de equipamentos
CREATE TABLE public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.equipment_categories(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  brand TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  color TEXT,
  pass_year TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;

-- Policy para super admins
CREATE POLICY "Super admins can manage equipments"
  ON public.equipments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = auth.uid() AND ag.is_super_admin = true
  ));

-- Trigger para updated_at
CREATE TRIGGER update_equipments_updated_at
  BEFORE UPDATE ON public.equipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir categorias com IDs específicos
INSERT INTO public.equipment_categories (id, name, icon) VALUES
  ('512e0f0b-5097-473b-b59d-1d82d199e447', 'Monitor', 'Monitor'),
  ('51801549-9917-4951-ab6a-58f6d72e44ed', 'Portátil', 'Laptop'),
  ('733b0295-8b26-4308-8796-3cc8cc9eb925', 'Tablet', 'Tablet'),
  ('95955a01-0f6b-48da-9a74-44b83bbd46b4', 'Telemóvel', 'Smartphone');