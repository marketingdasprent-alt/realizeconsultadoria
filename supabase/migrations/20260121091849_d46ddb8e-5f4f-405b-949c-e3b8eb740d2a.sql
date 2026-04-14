-- Create admin_groups table
CREATE TABLE public.admin_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_group_permissions table
CREATE TABLE public.admin_group_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.admin_groups(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id, module_key)
);

-- Create admin_group_members table
CREATE TABLE public.admin_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.admin_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.admin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_groups
CREATE POLICY "Admins can manage all groups"
ON public.admin_groups FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for admin_group_permissions
CREATE POLICY "Admins can manage all group permissions"
ON public.admin_group_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for admin_group_members
CREATE POLICY "Admins can manage all group members"
ON public.admin_group_members FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to get admin permissions for a user
CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid)
RETURNS TABLE (
  module_key TEXT,
  can_view BOOLEAN,
  can_edit BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- If user is in a super admin group, return all modules with full access
  SELECT 
    m.module_key,
    true AS can_view,
    true AS can_edit
  FROM (
    SELECT unnest(ARRAY['dashboard', 'companies', 'employees', 'requests', 'support', 'calendar', 'settings']) AS module_key
  ) m
  WHERE EXISTS (
    SELECT 1 
    FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = _user_id 
      AND ag.is_super_admin = true 
      AND ag.is_active = true
  )
  
  UNION ALL
  
  -- Otherwise, aggregate permissions from all groups the user belongs to
  SELECT 
    agp.module_key,
    bool_or(agp.can_view) AS can_view,
    bool_or(agp.can_edit) AS can_edit
  FROM admin_group_members agm
  JOIN admin_groups ag ON ag.id = agm.group_id
  JOIN admin_group_permissions agp ON agp.group_id = ag.id
  WHERE agm.user_id = _user_id 
    AND ag.is_active = true
    AND ag.is_super_admin = false
    AND NOT EXISTS (
      SELECT 1 
      FROM admin_group_members agm2
      JOIN admin_groups ag2 ON ag2.id = agm2.group_id
      WHERE agm2.user_id = _user_id 
        AND ag2.is_super_admin = true 
        AND ag2.is_active = true
    )
  GROUP BY agp.module_key
$$;

-- Function to check if user has permission for a module
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module_key text, _permission text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM get_admin_permissions(_user_id) p
    WHERE p.module_key = _module_key
      AND (
        (_permission = 'view' AND p.can_view = true)
        OR (_permission = 'edit' AND p.can_edit = true)
      )
  )
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_admin_groups_updated_at
BEFORE UPDATE ON public.admin_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default Super Admin group
INSERT INTO public.admin_groups (name, description, is_super_admin, is_active)
VALUES ('Super Admin', 'Acesso total a todos os módulos do sistema', true, true);