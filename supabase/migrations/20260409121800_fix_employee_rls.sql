-- Fix RLS circular dependency on employees table
-- This allows the user to find their own record to then get their company_id for other policies
-- Without this, get_employee_company_id(auth.uid()) fails because it can't read the employees table to find the company_id

DROP POLICY IF EXISTS "Employees can view own record" ON public.employees;

CREATE POLICY "Users can view own employee record"
ON public.employees
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
