-- Reverte o D2: remove os gatilhos e a função de proteção da identidade da ficha.
DROP TRIGGER IF EXISTS employees_guard_identity_update ON public.employees;
DROP TRIGGER IF EXISTS employees_guard_identity_insert ON public.employees;
DROP FUNCTION IF EXISTS public.employees_guard_identity();
