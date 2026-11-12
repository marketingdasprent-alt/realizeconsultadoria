-- App de email para clientes de fora (mail.realizeconsultadoria.pt): a caixa de email é a conta.
-- Estas contas (app_metadata.mail_only = true) entram na base de dados com o papel mail_client,
-- que só tem acesso às tabelas do email — o resto da Realize (tabelas e funções) fica fechado
-- pela própria base de dados, sem depender do código da app.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mail_client') THEN
    CREATE ROLE mail_client NOLOGIN NOINHERIT;
  END IF;
END $$;
GRANT mail_client TO authenticator;
GRANT USAGE ON SCHEMA public TO mail_client;
GRANT USAGE ON SCHEMA storage TO mail_client;

-- Só as tabelas do email (e as notificações push do próprio)
GRANT SELECT, UPDATE ON public.mail_accounts TO mail_client;
GRANT SELECT, UPDATE ON public.mail_account_members TO mail_client;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.mail_account_order, public.mail_contacts, public.mail_contact_lists,
  public.mail_draft_meta, public.mail_signatures, public.push_subscriptions
  TO mail_client;
GRANT INSERT ON public.push_issues TO mail_client;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mail_client;
GRANT EXECUTE ON FUNCTION public.mail_is_member(uuid, uuid) TO mail_client;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO mail_client;
GRANT EXECUTE ON FUNCTION public.mail_remember_contacts TO mail_client;
GRANT EXECUTE ON FUNCTION public.rz_save_push_subscription(text, text, text, text) TO mail_client;

-- As regras (RLS) dessas tabelas passam a valer também para mail_client
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE (schemaname = 'public' AND tablename IN ('mail_accounts', 'mail_account_members',
             'mail_account_order', 'mail_contacts', 'mail_contact_lists', 'mail_draft_meta',
             'mail_signatures', 'push_subscriptions', 'push_issues'))
       OR (schemaname = 'storage' AND tablename = 'objects'
           AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%mail-signatures%')
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated, mail_client',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;
GRANT SELECT, INSERT, DELETE ON storage.objects TO mail_client;
GRANT SELECT ON storage.buckets TO mail_client;

-- Regra do login (Custom Access Token Hook): contas só de email → papel mail_client
CREATE OR REPLACE FUNCTION public.rz_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE
AS $$
DECLARE
  claims jsonb := event -> 'claims';
BEGIN
  IF (claims -> 'app_metadata' ->> 'mail_only') = 'true' THEN
    claims := jsonb_set(claims, '{role}', '"mail_client"');
  END IF;
  RETURN jsonb_build_object('claims', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('claims', event -> 'claims');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rz_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.rz_access_token_hook(jsonb) FROM authenticated, anon, public;
