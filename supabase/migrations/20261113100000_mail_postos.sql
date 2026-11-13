-- Realize Mail: postos de email. O admin cria um posto (ex.: "Receção Lisboa"), escolhe as caixas
-- dos Acessos que ele terá e envia um link a quem vai instalar a app. Quem abre o link entra já
-- com essas caixas, sem palavra-passe: a palavra-passe fica no servidor (cofre da caixa partilhada).
--
-- Cada posto tem uma conta interna só de email (papel mail_client, igual à dos clientes de fora) e
-- vê as caixas pelo mesmo mecanismo das caixas partilhadas (mail_account_members). As tabelas são
-- só para o servidor (RLS ligado e sem regras); o admin lê por funções que confirmam rz_is_admin().

CREATE TABLE IF NOT EXISTS public.mail_postos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- Conta interna do posto (apagá-la apaga o posto)
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mail_postos ENABLE ROW LEVEL SECURITY;

-- Caixas (acessos de email) de cada posto
CREATE TABLE IF NOT EXISTS public.mail_posto_boxes (
  posto_id uuid NOT NULL REFERENCES public.mail_postos(id) ON DELETE CASCADE,
  access_id uuid NOT NULL REFERENCES public.accesses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (posto_id, access_id)
);
CREATE INDEX IF NOT EXISTS mail_posto_boxes_access_idx ON public.mail_posto_boxes (access_id);
ALTER TABLE public.mail_posto_boxes ENABLE ROW LEVEL SECURITY;

-- Convites: só se guarda o hash do código (o link com o código só aparece uma vez, ao admin)
CREATE TABLE IF NOT EXISTS public.mail_posto_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id uuid NOT NULL REFERENCES public.mail_postos(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_posto_invites_posto_idx ON public.mail_posto_invites (posto_id);
ALTER TABLE public.mail_posto_invites ENABLE ROW LEVEL SECURITY;

-- Quem deve ter a caixa de um acesso: agora também as contas dos postos que a têm. Sem isto, a
-- sincronização dos membros (que apaga quem não está na lista) retirava a caixa aos postos.
CREATE OR REPLACE FUNCTION public.mail_access_wanted_members(p_access uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id
  FROM employee_department_emails d
  JOIN employees e ON e.id = d.employee_id
  WHERE d.access_id = p_access AND e.user_id IS NOT NULL AND e.is_active
  UNION
  SELECT e.user_id
  FROM accesses a
  JOIN employees e ON e.id = a.employee_id
  WHERE a.id = p_access AND e.user_id IS NOT NULL AND e.is_active
    AND mail_is_email_access(a.id)
    AND NOT EXISTS (
      SELECT 1 FROM mail_accounts own
      WHERE own.user_id = e.user_id AND own.access_id IS NULL
        AND lower(own.email) = lower(trim(a.username))
    )
  UNION
  SELECT p.user_id
  FROM mail_posto_boxes b
  JOIN mail_postos p ON p.id = b.posto_id
  WHERE b.access_id = p_access;
$$;
REVOKE ALL ON FUNCTION public.mail_access_wanted_members(uuid) FROM PUBLIC, anon, authenticated;

-- Os postos não são "clientes de fora": ficam fora da lista de clientes do admin
CREATE OR REPLACE FUNCTION public.admin_mail_clients()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'userId', m.user_id,
      'mailbox', m.mailbox,
      'name', coalesce(u.raw_user_meta_data ->> 'name', m.mailbox),
      'createdAt', m.created_at,
      'lastLoginAt', m.last_login_at,
      'disabledAt', m.disabled_at,
      'companyId', coalesce(m.company_id, last_ticket.company_id),
      'companyName', (SELECT trim(c.name) FROM companies c
                       WHERE c.id = coalesce(m.company_id, last_ticket.company_id)),
      'companyFromTicket', m.company_id IS NULL AND last_ticket.company_id IS NOT NULL,
      'accounts', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', a.id, 'email', a.email,
                 'displayName', a.display_name, 'provider', a.provider, 'status', a.status)
               ORDER BY a.is_default DESC, a.created_at)
        FROM mail_accounts a WHERE a.user_id = m.user_id), '[]'::jsonb),
      'ticketsOpen', (SELECT count(*) FROM support_tickets t
                       WHERE t.requester_user_id = m.user_id AND t.status IN ('open', 'in_progress')),
      'ticketsTotal', (SELECT count(*) FROM support_tickets t WHERE t.requester_user_id = m.user_id)
    ) ORDER BY coalesce(m.last_login_at, m.created_at) DESC)
    FROM mail_app_users m
    LEFT JOIN auth.users u ON u.id = m.user_id
    LEFT JOIN LATERAL (
      SELECT t.company_id FROM support_tickets t
      WHERE t.requester_user_id = m.user_id ORDER BY t.created_at DESC LIMIT 1
    ) last_ticket ON true
    WHERE NOT EXISTS (SELECT 1 FROM mail_postos p WHERE p.user_id = m.user_id)
  ), '[]'::jsonb);
END;
$$;

-- Lista dos postos: caixas (com o estado de cada uma), último acesso e convite por usar
CREATE OR REPLACE FUNCTION public.admin_mail_postos()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'userId', p.user_id,
      'name', p.name,
      'createdAt', p.created_at,
      'lastLoginAt', m.last_login_at,
      'disabledAt', m.disabled_at,
      'inviteExpiresAt', (SELECT max(i.expires_at) FROM mail_posto_invites i
                           WHERE i.posto_id = p.id AND i.used_at IS NULL AND i.expires_at > now()),
      'boxes', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'accessId', b.access_id,
                 'title', a.title,
                 'email', lower(trim(a.username)),
                 'accountId', ma.id,
                 'status', coalesce(ma.status, 'pending'),
                 'lastError', ma.last_error)
               ORDER BY lower(trim(a.username)))
        FROM mail_posto_boxes b
        JOIN accesses a ON a.id = b.access_id
        LEFT JOIN mail_accounts ma ON ma.access_id = b.access_id
        WHERE b.posto_id = p.id), '[]'::jsonb)
    ) ORDER BY p.created_at DESC)
    FROM mail_postos p
    LEFT JOIN mail_app_users m ON m.user_id = p.user_id
  ), '[]'::jsonb);
END;
$$;

-- Acessos de email que se podem pôr num posto (com a empresa e se a caixa já está ligada)
CREATE OR REPLACE FUNCTION public.admin_mail_posto_accesses()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'accessId', a.id,
      'title', a.title,
      'email', lower(trim(a.username)),
      'companyName', (SELECT trim(c.name) FROM companies c WHERE c.id = a.company_id),
      'connected', EXISTS (SELECT 1 FROM mail_accounts ma WHERE ma.access_id = a.id)
    ) ORDER BY lower(trim(a.username)))
    FROM accesses a
    WHERE mail_is_email_access(a.id)
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mail_postos(), public.admin_mail_posto_accesses()
  FROM PUBLIC, anon, mail_client;
GRANT EXECUTE ON FUNCTION public.admin_mail_postos(), public.admin_mail_posto_accesses()
  TO authenticated;
-- (o REVOKE de admin_mail_clients da migração anterior mantém-se: CREATE OR REPLACE não mexe nas permissões)
