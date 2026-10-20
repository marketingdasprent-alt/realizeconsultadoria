-- Realize 2.0 · Funções sempre prontas: a primeira chamada a uma edge function parada demora
-- ~10 s (o Supabase tem de a arrancar). Um pedido curto a cada 30 segundos mantém-nas acordadas.
-- O pedido não tem sessão: a função responde logo 401 (não faz nada nem lê dados).
CREATE OR REPLACE FUNCTION public.rz_keep_functions_warm()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net
AS $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['company-files', 'ai-chat'] LOOP
    PERFORM net.http_post(
      url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/' || v_fn,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_keep_functions_warm() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-keep-functions-warm', '30 seconds', 'SELECT public.rz_keep_functions_warm()');
