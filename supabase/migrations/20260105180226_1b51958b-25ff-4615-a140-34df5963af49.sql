-- Backfill: Link existing employees to users based on email match
UPDATE public.employees e
SET user_id = p.user_id
FROM public.profiles p
WHERE lower(trim(e.email)) = lower(trim(p.email))
  AND e.user_id IS NULL;

-- Insert employee role for newly linked users (skip if already has role)
INSERT INTO public.user_roles (user_id, role)
SELECT e.user_id, 'employee'::app_role
FROM public.employees e
WHERE e.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Improve the trigger function to be case-insensitive and trim whitespace
CREATE OR REPLACE FUNCTION public.link_employee_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Associate user_id to employee if email matches (case-insensitive, trimmed)
  UPDATE public.employees 
  SET user_id = NEW.id
  WHERE lower(trim(email)) = lower(trim(NEW.email))
    AND user_id IS NULL;
  
  -- Add employee role if association was made
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;