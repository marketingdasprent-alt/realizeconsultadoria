-- Realize AI · o interruptor "Resumo diário" nunca gravava.
-- O upsert do browser (INSERT … ON CONFLICT DO UPDATE) põe user_id no SET, e o authenticated
-- só tinha UPDATE em daily_digest/updated_at: "permission denied" e o interruptor voltava atrás.
-- As regras (user_id = auth.uid()) continuam a impedir mexer na linha de outra pessoa.
GRANT UPDATE (user_id) ON public.ai_preferences TO authenticated;
-- O anon nunca precisa desta tabela.
REVOKE ALL ON public.ai_preferences FROM anon;
