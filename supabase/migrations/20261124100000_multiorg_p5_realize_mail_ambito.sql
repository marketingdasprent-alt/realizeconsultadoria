-- Multi-organização, PR5: o admin de uma empresa só vê e gere o Realize Mail (clientes, postos e caixas) das
-- empresas que administra; o super admin continua a ver tudo.
--
-- Problema: as funções admin_mail_* só confirmavam rz_is_admin() (admin global antigo). Um administrador de
-- uma empresa recebia TODOS os clientes de email, os acessos de email de todas as empresas (título,
-- endereço e empresa) e podia desligar um cliente ou mudar a empresa de um cliente de outra empresa.
--
-- O que muda (só CREATE OR REPLACE de funções; nada é apagado nem alterado nos dados):
--   * rz_mail_client_in_scope(uuid) e rz_mail_posto_in_scope(uuid): decidem se um cliente / um posto está nas
--     empresas de quem chama (super admin: tudo, incluindo clientes sem empresa).
--   * admin_mail_clients, admin_mail_client_set_company, admin_mail_client_set_disabled,
--     admin_mail_client_signatures, admin_mail_client_save_signatures: só clientes das empresas do admin; a
--     empresa de um cliente só se muda para uma empresa que o admin também administra.
--   * admin_mail_postos e admin_mail_posto_accesses: só postos e caixas das empresas do admin; passam a
--     devolver companyId (o ecrã filtra pelo seletor de empresa).
--   * rz_mail_access_ok_for(uuid, uuid) e rz_mail_posto_ok_for(uuid, uuid): para a função mail-posto
--     (service role) validar que a pessoa administra as caixas e o posto em que mexe.
-- Rollback: supabase/rollbacks/20261124100000_multiorg_p5_realize_mail_ambito_rollback.sql

-- ------------------------------------------------------------------ funções de âmbito
-- O cliente de email está nas empresas de quem chama (a associada no admin, senão a do último ticket).
CREATE OR REPLACE FUNCTION public.rz_mail_client_in_scope(p_user uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.mail_app_users m
    LEFT JOIN LATERAL (
      SELECT t.company_id FROM public.support_tickets t
      WHERE t.requester_user_id = m.user_id ORDER BY t.created_at DESC LIMIT 1
    ) last_ticket ON true
    WHERE m.user_id = p_user
      AND coalesce(m.company_id, last_ticket.company_id) = ANY (public.rz_admin_company_ids()));
$function$;

-- O posto tem caixas e todas são de empresas de quem chama (um posto sem caixas é só de quem o criou).
CREATE OR REPLACE FUNCTION public.rz_mail_posto_in_scope(p_posto uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin() OR (
    NOT EXISTS (SELECT 1 FROM public.mail_posto_boxes b
                JOIN public.accesses a ON a.id = b.access_id
                WHERE b.posto_id = p_posto
                  AND (a.company_id IS NULL OR NOT (a.company_id = ANY (public.rz_admin_company_ids()))))
    AND (EXISTS (SELECT 1 FROM public.mail_posto_boxes b WHERE b.posto_id = p_posto)
         OR EXISTS (SELECT 1 FROM public.mail_postos p WHERE p.id = p_posto AND p.created_by = auth.uid())));
$function$;

-- Para a edge function mail-posto (service role): a conta p_user administra a empresa do acesso / do posto.
CREATE OR REPLACE FUNCTION public.rz_mail_access_ok_for(p_user uuid, p_access uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.accesses a
    WHERE a.id = p_access
      AND (public.rz_is_super_admin_for(p_user)
           OR (a.company_id IS NOT NULL AND public.rz_is_company_admin_for(p_user, a.company_id))));
$function$;

CREATE OR REPLACE FUNCTION public.rz_mail_posto_ok_for(p_user uuid, p_posto uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin_for(p_user) OR (
    NOT EXISTS (SELECT 1 FROM public.mail_posto_boxes b
                WHERE b.posto_id = p_posto AND NOT public.rz_mail_access_ok_for(p_user, b.access_id))
    AND (EXISTS (SELECT 1 FROM public.mail_posto_boxes b WHERE b.posto_id = p_posto)
         OR EXISTS (SELECT 1 FROM public.mail_postos p WHERE p.id = p_posto AND p.created_by = p_user)));
$function$;

REVOKE ALL ON FUNCTION public.rz_mail_client_in_scope(uuid), public.rz_mail_posto_in_scope(uuid),
  public.rz_mail_access_ok_for(uuid, uuid), public.rz_mail_posto_ok_for(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rz_mail_access_ok_for(uuid, uuid), public.rz_mail_posto_ok_for(uuid, uuid)
  TO service_role;

-- ------------------------------------------------------------------ funções do Realize Mail
CREATE OR REPLACE FUNCTION public.admin_mail_clients()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
      -- só os clientes das empresas que a pessoa administra (o super admin vê todos, também os sem empresa)
      AND (rz_is_super_admin()
           OR coalesce(m.company_id, last_ticket.company_id) = ANY (rz_admin_company_ids()))
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mail_client_set_company(_user_id uuid, _company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  IF NOT rz_mail_client_in_scope(_user_id) THEN
    RAISE EXCEPTION 'Não é um cliente da Realize Mail das suas empresas';
  END IF;
  -- um administrador de empresa só passa o cliente para uma empresa que também administra
  IF NOT rz_is_super_admin()
     AND (_company_id IS NULL OR NOT (_company_id = ANY (rz_admin_company_ids()))) THEN
    RAISE EXCEPTION 'Só pode escolher uma empresa que administra';
  END IF;
  UPDATE mail_app_users SET company_id = _company_id WHERE user_id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mail_client_set_disabled(_user_id uuid, _disabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  IF NOT rz_mail_client_in_scope(_user_id) THEN
    RAISE EXCEPTION 'Não é um cliente da Realize Mail das suas empresas';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_mail_client_signatures(_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'html', s.html,
             'isDefault', s.is_default) ORDER BY s.position, s.created_at)
    FROM mail_signatures s
    JOIN mail_accounts a ON a.id = s.account_id AND a.user_id = s.user_id
    JOIN mail_app_users m ON m.user_id = a.user_id
    WHERE s.account_id = _account_id AND rz_mail_client_in_scope(a.user_id)
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mail_client_save_signatures(_account_id uuid, _list jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF owner IS NULL OR NOT rz_mail_client_in_scope(owner) THEN
    RAISE EXCEPTION 'Caixa de cliente não encontrada';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_mail_postos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
                 'companyId', a.company_id,
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
    -- só os postos cujas caixas são todas de empresas que a pessoa administra
    WHERE rz_mail_posto_in_scope(p.id)
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mail_posto_accesses()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT rz_is_admin() THEN RAISE EXCEPTION 'Só para admins'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'accessId', a.id,
      'title', a.title,
      'email', lower(trim(a.username)),
      'companyId', a.company_id,
      'companyName', (SELECT trim(c.name) FROM companies c WHERE c.id = a.company_id),
      'connected', EXISTS (SELECT 1 FROM mail_accounts ma WHERE ma.access_id = a.id)
    ) ORDER BY lower(trim(a.username)))
    FROM accesses a
    WHERE mail_is_email_access(a.id)
      -- só as caixas das empresas que a pessoa administra (o super admin vê todas)
      AND (rz_is_super_admin() OR a.company_id = ANY (rz_admin_company_ids()))
  ), '[]'::jsonb);
END;
$function$;
