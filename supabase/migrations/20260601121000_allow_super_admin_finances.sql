-- Permite que membros de grupos super-admin também escrevam em
-- employee_monthly_finances (além do grupo RH, que já era permitido).

-- Helper: pertence a algum grupo super-admin activo?
CREATE OR REPLACE FUNCTION public.is_super_admin_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = _user_id
      AND ag.is_super_admin = true
      AND ag.is_active = true
  )
$$;

-- Substituir as políticas existentes para incluir super admin
DROP POLICY IF EXISTS "RH can insert employee finances" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "RH can update employee finances" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "RH can delete employee finances" ON public.employee_monthly_finances;

CREATE POLICY "RH or super admin can insert employee finances"
ON public.employee_monthly_finances FOR INSERT
TO authenticated
WITH CHECK (
  public.is_rh_member(auth.uid())
  OR public.is_super_admin_member(auth.uid())
);

CREATE POLICY "RH or super admin can update employee finances"
ON public.employee_monthly_finances FOR UPDATE
TO authenticated
USING (
  public.is_rh_member(auth.uid())
  OR public.is_super_admin_member(auth.uid())
)
WITH CHECK (
  public.is_rh_member(auth.uid())
  OR public.is_super_admin_member(auth.uid())
);

CREATE POLICY "RH or super admin can delete employee finances"
ON public.employee_monthly_finances FOR DELETE
TO authenticated
USING (
  public.is_rh_member(auth.uid())
  OR public.is_super_admin_member(auth.uid())
);
