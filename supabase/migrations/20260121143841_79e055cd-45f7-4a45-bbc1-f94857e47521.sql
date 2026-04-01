-- Create support_departments table
CREATE TABLE public.support_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_departments ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_departments
CREATE POLICY "Admins can manage all departments"
ON public.support_departments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active departments"
ON public.support_departments FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Add department_id to support_ticket_subjects
ALTER TABLE public.support_ticket_subjects
ADD COLUMN department_id uuid REFERENCES public.support_departments(id) ON DELETE SET NULL;

-- Add department_id to support_tickets
ALTER TABLE public.support_tickets
ADD COLUMN department_id uuid REFERENCES public.support_departments(id) ON DELETE SET NULL;

-- Create admin_group_support_departments junction table
CREATE TABLE public.admin_group_support_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.admin_groups(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.support_departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, department_id)
);

-- Enable RLS
ALTER TABLE public.admin_group_support_departments ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_group_support_departments
CREATE POLICY "Admins can manage all group departments"
ON public.admin_group_support_departments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to get user's accessible support departments
CREATE OR REPLACE FUNCTION public.get_user_support_departments(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- If user is in a super admin group, return all active departments
  SELECT sd.id
  FROM support_departments sd
  WHERE sd.is_active = true
    AND EXISTS (
      SELECT 1 
      FROM admin_group_members agm
      JOIN admin_groups ag ON ag.id = agm.group_id
      WHERE agm.user_id = _user_id 
        AND ag.is_super_admin = true 
        AND ag.is_active = true
    )
  
  UNION
  
  -- Otherwise, return departments from user's groups
  SELECT DISTINCT agsd.department_id
  FROM admin_group_members agm
  JOIN admin_groups ag ON ag.id = agm.group_id
  JOIN admin_group_support_departments agsd ON agsd.group_id = ag.id
  JOIN support_departments sd ON sd.id = agsd.department_id
  WHERE agm.user_id = _user_id 
    AND ag.is_active = true
    AND sd.is_active = true
    AND NOT EXISTS (
      SELECT 1 
      FROM admin_group_members agm2
      JOIN admin_groups ag2 ON ag2.id = agm2.group_id
      WHERE agm2.user_id = _user_id 
        AND ag2.is_super_admin = true 
        AND ag2.is_active = true
    )
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_support_departments_updated_at
BEFORE UPDATE ON public.support_departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();