-- Acessos → Emails: estado da caixa de cada acesso no Webmail (ligada, com erro) e quem a
-- tem. Só para admins (as contas de email só são visíveis para os próprios/membros).
CREATE OR REPLACE FUNCTION public.mail_access_status()
RETURNS TABLE (
  access_id uuid,
  account_id uuid,
  status text,
  last_error text,
  provider text,
  last_sync_at timestamptz,
  members text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.access_id, m.id, m.status, m.last_error, m.provider, m.last_sync_at,
         coalesce(
           (SELECT array_agg(e.name ORDER BY e.name)
            FROM mail_account_members am
            JOIN employees e ON e.user_id = am.user_id
            WHERE am.account_id = m.id),
           '{}'
         )
  FROM mail_accounts m
  WHERE m.access_id IS NOT NULL AND has_role(auth.uid(), 'admin');
$$;
REVOKE ALL ON FUNCTION public.mail_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mail_access_status() TO authenticated;
