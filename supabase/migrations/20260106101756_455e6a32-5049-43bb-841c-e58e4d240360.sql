-- Add employee_id column to notifications for individual notices
ALTER TABLE public.notifications 
ADD COLUMN employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_notifications_employee_id ON public.notifications(employee_id);

-- Drop existing employee select policy and recreate with individual notices support
DROP POLICY IF EXISTS "Employees can view active notifications for their company" ON public.notifications;

-- Helper function to get employee id from user id
CREATE OR REPLACE FUNCTION public.get_employee_id_from_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

-- Updated policy: employees can view global, company, OR individual notices
CREATE POLICY "Employees can view active notifications for their company or individual"
ON public.notifications
FOR SELECT
USING (
  (is_active = true) 
  AND ((expires_at IS NULL) OR (expires_at > now())) 
  AND (
    (company_id IS NULL AND employee_id IS NULL) -- global notices
    OR (company_id = get_employee_company_id(auth.uid()) AND employee_id IS NULL) -- company notices
    OR (employee_id = get_employee_id_from_user(auth.uid())) -- individual notices
  )
);