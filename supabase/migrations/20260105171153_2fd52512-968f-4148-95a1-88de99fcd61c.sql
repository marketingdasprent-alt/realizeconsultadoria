-- Função que associa user_id ao employee quando o email coincide
CREATE OR REPLACE FUNCTION public.link_employee_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Associar user_id ao employee se o email coincidir
  UPDATE public.employees 
  SET user_id = NEW.id
  WHERE email = NEW.email 
    AND user_id IS NULL;
  
  -- Adicionar role de employee se foi associado
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que executa após signup
CREATE TRIGGER on_auth_user_link_employee
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_employee_on_signup();