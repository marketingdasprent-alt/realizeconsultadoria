-- Realize 2.0 · Privacidade: o diretório dos colegas (perfis, Messenger, pesquisa) deixa de
-- mostrar o email e o telefone pessoais da ficha. Passa a mostrar só os contactos da empresa
-- atribuídos à pessoa: o email do acesso "Email Pessoal" de que é dona (ex.:
-- nome@dasprent.pt) e o telemóvel atribuído na lista de telefones.

DROP FUNCTION IF EXISTS public.chat_directory();
CREATE FUNCTION public.chat_directory()
RETURNS TABLE (
  user_id uuid,
  employee_id uuid,
  name text,
  "position" text,
  department text,
  email text,
  company_id uuid,
  company_name text,
  avatar_path text,
  phone text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id, e.id, e.name, e.position, e.department,
         (SELECT a.username FROM accesses a
          JOIN access_categories ac ON ac.id = a.category_id
          WHERE a.employee_id = e.id AND ac.name = 'Email Pessoal' AND a.username LIKE '%_@_%'
          ORDER BY a.created_at LIMIT 1),
         e.company_id, c.name,
         p.avatar_path,
         (SELECT ph.phone_number FROM phones ph
          WHERE ph.employee_id = e.id
          ORDER BY ph.created_at LIMIT 1)
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN user_profiles p ON p.user_id = e.user_id
  WHERE e.is_active
    AND e.user_id IS NOT NULL
    AND e.company_id = (SELECT me.company_id FROM employees me
                        WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  ORDER BY e.name;
$$;
REVOKE ALL ON FUNCTION public.chat_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_directory() TO authenticated;
