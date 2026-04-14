-- Fix RLS policies for support_departments
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view active departments" ON public.support_departments;
DROP POLICY IF EXISTS "Admins can manage all departments" ON public.support_departments;

-- Recreate admin policy (PERMISSIVE is the default)
CREATE POLICY "Admins can manage all departments"
ON public.support_departments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate authenticated users policy
CREATE POLICY "Authenticated users can view active departments"
ON public.support_departments
FOR SELECT
TO authenticated
USING (is_active = true);