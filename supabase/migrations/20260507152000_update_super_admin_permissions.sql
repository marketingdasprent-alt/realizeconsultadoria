-- Update get_admin_permissions function to include 'marketing' module for Super Admins
CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid)
RETURNS TABLE(module_key text, topic_key text, can_view boolean, can_edit boolean, can_execute boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- If user is in a super admin group, return all modules with full access
  SELECT 
    m.module_key,
    NULL::text AS topic_key,
    true AS can_view,
    true AS can_edit,
    true AS can_execute
  FROM (
    SELECT unnest(ARRAY['dashboard', 'companies', 'employees', 'requests', 'support', 'calendar', 'settings', 'marketing']) AS module_key
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
    agp.topic_key,
    bool_or(agp.can_view) AS can_view,
    bool_or(agp.can_edit) AS can_edit,
    bool_or(agp.can_execute) AS can_execute
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
  GROUP BY agp.module_key, agp.topic_key
$$;
