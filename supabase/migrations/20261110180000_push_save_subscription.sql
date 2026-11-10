-- Guardar a subscrição push deste browser para quem está com a sessão aberta. Pela tabela
-- (RLS) não dava se o mesmo browser já tinha sido subscrito por outra conta (o upsert tentava
-- alterar uma linha de outra pessoa e era recusado): a subscrição passa para quem a ativa agora.
CREATE OR REPLACE FUNCTION public.rz_save_push_subscription(
  _endpoint text, _p256dh text, _auth text, _user_agent text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(_endpoint, '') !~ '^https://' THEN
    RAISE EXCEPTION 'Subscrição inválida';
  END IF;
  -- As antigas deste browser (outro endpoint) saem: senão cada aviso chegava em duplicado
  DELETE FROM push_subscriptions
  WHERE user_id = auth.uid() AND user_agent = left(_user_agent, 300) AND endpoint <> _endpoint;
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), _endpoint, _p256dh, _auth, left(_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_save_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_save_push_subscription(text, text, text, text) TO authenticated;
