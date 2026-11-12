-- mail_client (app de email para clientes de fora) não pode chamar funções da Realize. No
-- Postgres as funções ficam executáveis por PUBLIC (todos os papéis): passam a ter a permissão
-- explícita de quem já as usava (anon, authenticated, service_role) e PUBLIC sai.
-- Para a Realize nada muda.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND has_function_privilege('public', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.sig);
  END LOOP;
END $$;
-- As que forem criadas daqui para a frente também
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- A regra do login é só para o Auth
REVOKE EXECUTE ON FUNCTION public.rz_access_token_hook(jsonb) FROM anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rz_access_token_hook(jsonb) TO supabase_auth_admin;

-- Regras de ficheiros "para todos" que só servem colaboradores (precisam de sessão): passam a
-- valer só para authenticated (consultavam employees e davam erro ao mail_client)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND roles::text[] && ARRAY['public']
  LOOP
    EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated', pol.policyname);
  END LOOP;
END $$;

-- O Auth chama a regra no schema public (documentação da Supabase)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
