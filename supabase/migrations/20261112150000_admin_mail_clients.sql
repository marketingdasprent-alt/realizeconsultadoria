-- Admin → Realize Mail: os clientes (quem entrou na app de email), a empresa de cada um, desligar
-- o acesso e as assinaturas das caixas deles (o cliente pode alterá-las depois). Tudo por funções
-- que confirmam que quem chama é admin (rz_is_admin); as tabelas continuam fechadas.

ALTER TABLE public.mail_app_users
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- Lista dos clientes: caixa de entrada, nome, empresa (a associada, senão a do último ticket),
-- datas, caixas ligadas e tickets
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
  ), '[]'::jsonb);
END;
$$;

-- Empresa do cliente (null = volta a usar a do último ticket)
CREATE OR REPLACE FUNCTION public.admin_mail_client_set_company(_user_id uuid, _company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  UPDATE mail_app_users SET company_id = _company_id WHERE user_id = _user_id;
END;
$$;

-- Desligar / religar o acesso: a conta fica bloqueada no login, as sessões abertas acabam e as
-- caixas deixam de ser lidas (status reauth). Ao religar, o cliente volta a entrar com a caixa.
CREATE OR REPLACE FUNCTION public.admin_mail_client_set_disabled(_user_id uuid, _disabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mail_app_users WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Não é um cliente da Realize Mail';
  END IF;
  UPDATE mail_app_users SET disabled_at = CASE WHEN _disabled THEN now() END
  WHERE user_id = _user_id;
  UPDATE auth.users SET banned_until = CASE WHEN _disabled THEN 'infinity'::timestamptz END
  WHERE id = _user_id AND (raw_app_meta_data ->> 'mail_only') = 'true';
  IF _disabled THEN
    DELETE FROM auth.sessions WHERE user_id = _user_id;
    UPDATE mail_accounts SET status = 'reauth', last_error = 'Acesso desligado pelo admin'
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- Assinaturas de uma caixa de um cliente (lista e gravar, como no Webmail)
CREATE OR REPLACE FUNCTION public.admin_mail_client_signatures(_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'html', s.html,
             'isDefault', s.is_default) ORDER BY s.position, s.created_at)
    FROM mail_signatures s
    JOIN mail_accounts a ON a.id = s.account_id AND a.user_id = s.user_id
    JOIN mail_app_users m ON m.user_id = a.user_id
    WHERE s.account_id = _account_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mail_client_save_signatures(_account_id uuid, _list jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  owner uuid;
  item jsonb;
  pos integer := 0;
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  -- Só caixas de clientes da Realize Mail (nunca as de colaboradores)
  SELECT a.user_id INTO owner FROM mail_accounts a
  JOIN mail_app_users m ON m.user_id = a.user_id
  WHERE a.id = _account_id;
  IF owner IS NULL THEN RAISE EXCEPTION 'Caixa de cliente não encontrada'; END IF;
  IF jsonb_typeof(_list) <> 'array' OR jsonb_array_length(_list) > 20 THEN
    RAISE EXCEPTION 'Lista inválida';
  END IF;

  DELETE FROM mail_signatures s
  WHERE s.user_id = owner AND s.account_id = _account_id
    AND s.id NOT IN (SELECT (x ->> 'id')::uuid FROM jsonb_array_elements(_list) x);
  UPDATE mail_signatures SET is_default = false WHERE user_id = owner AND account_id = _account_id;
  FOR item IN SELECT * FROM jsonb_array_elements(_list) LOOP
    INSERT INTO mail_signatures (id, user_id, account_id, name, html, is_default, position)
    VALUES ((item ->> 'id')::uuid, owner, _account_id, left(coalesce(item ->> 'name', 'Assinatura'), 60),
            coalesce(item ->> 'html', ''), coalesce((item ->> 'isDefault')::boolean, false), pos)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, html = EXCLUDED.html, is_default = EXCLUDED.is_default,
          position = EXCLUDED.position
      WHERE mail_signatures.user_id = owner AND mail_signatures.account_id = _account_id;
    pos := pos + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mail_clients(),
  public.admin_mail_client_set_company(uuid, uuid),
  public.admin_mail_client_set_disabled(uuid, boolean),
  public.admin_mail_client_signatures(uuid),
  public.admin_mail_client_save_signatures(uuid, jsonb) FROM PUBLIC, anon, mail_client;
GRANT EXECUTE ON FUNCTION public.admin_mail_clients(),
  public.admin_mail_client_set_company(uuid, uuid),
  public.admin_mail_client_set_disabled(uuid, boolean),
  public.admin_mail_client_signatures(uuid),
  public.admin_mail_client_save_signatures(uuid, jsonb) TO authenticated;
